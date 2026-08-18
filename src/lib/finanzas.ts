// src/lib/finanzas.ts
//
// Orquesta las escrituras que involucran más de una tabla (por ejemplo, un
// gasto pagado con dinero de ahorro también tiene que mover el saldo de esa
// cuenta de ahorro) y la materialización de los domiciliados en efectivo.
// La lógica de "qué efecto tiene cada movimiento sobre el dinero disponible"
// vive en src/utils/finanzas.ts (puro, testeado); aquí solo se decide qué
// filas crear/borrar en la base de datos.

import { prisma } from '@/lib/prisma';
import {
  hoyMexico,
  fechaUTC,
  finDelDia,
  diaMexico,
  ocurrenciasDelMes,
  ocurrenciasSemanales,
  parseDiasSemana,
} from '@/utils/calculos';
import type { Prisma } from '@prisma/client';

const CORTE_1 = 10;
const CORTE_2 = 25;

export type FuenteDinero = 'disponible' | 'ahorro' | 'tercero';

// Clave en Configuracion donde se guarda el saldo disponible real: un número
// que se ajusta solo con tus ingresos y gastos reales (ver ajustarSaldoDisponible
// y materializarIngresos), y que también puedes corregir a mano desde el
// Dashboard cuando lo revises contra tu banco.
export const CLAVE_SALDO_DISPONIBLE = 'saldoDisponibleManual';

/**
 * Suma (o resta, si delta es negativo) al saldo disponible guardado en
 * Configuracion. No es perfectamente atómico (lee, calcula, escribe) pero
 * esta app es de un solo usuario, así que el riesgo de carrera es mínimo.
 */
export async function ajustarSaldoDisponible(delta: number): Promise<void> {
  if (delta === 0) return;
  const config = await prisma.configuracion.findUnique({ where: { clave: CLAVE_SALDO_DISPONIBLE } });
  const actual = config ? parseFloat(config.valor) : 0;
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_SALDO_DISPONIBLE },
    create: { clave: CLAVE_SALDO_DISPONIBLE, valor: String(actual + delta) },
    update: { valor: String(actual + delta) },
  });
}

interface DatosGastoOFuente {
  fuente: FuenteDinero;
  ahorroLugarId?: number | null;
  depositoTerceroId?: number | null;
  cantidad: number;
}

/** Valida que, si fuente="ahorro"/"tercero", venga el id correspondiente. */
export function validarFuente(datos: DatosGastoOFuente): string | null {
  if (datos.fuente === 'ahorro' && !datos.ahorroLugarId) {
    return 'Selecciona de qué cuenta de ahorro sale el dinero';
  }
  if (datos.fuente === 'tercero' && !datos.depositoTerceroId) {
    return 'Selecciona a qué depósito de tercero corresponde';
  }
  return null;
}

/**
 * Crea el GastoVariable y, si fuente="ahorro", el MovimientoAhorro (retiro)
 * vinculado que descuenta el saldo de esa cuenta -- todo en una transacción.
 */
export async function crearGastoVariable(datos: {
  nombre: string;
  cantidad: number;
  categoriaId: number;
  fecha?: Date;
  notas?: string | null;
  tipoPresupuesto?: string | null;
  fuente: FuenteDinero;
  ahorroLugarId?: number | null;
  depositoTerceroId?: number | null;
}) {
  const fecha = datos.fecha ?? new Date();

  if (datos.fuente === 'ahorro' && datos.ahorroLugarId) {
    return prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoAhorro.create({
        data: {
          ahorroId: datos.ahorroLugarId!,
          tipo: 'retiro',
          cantidad: datos.cantidad,
          concepto: `Pago: ${datos.nombre}`,
          fecha,
          origen: 'pago_gasto',
        },
      });
      await tx.ahorroLugar.update({
        where: { id: datos.ahorroLugarId! },
        data: { saldoActual: { decrement: datos.cantidad } },
      });
      return tx.gastoVariable.create({
        data: {
          nombre: datos.nombre,
          cantidad: datos.cantidad,
          categoriaId: datos.categoriaId,
          fecha,
          notas: datos.notas,
          tipoPresupuesto: datos.tipoPresupuesto,
          fuente: 'ahorro',
          ahorroLugarId: datos.ahorroLugarId,
          movimientoAhorroId: movimiento.id,
        },
        include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
      });
    });
  }

  const gasto = await prisma.gastoVariable.create({
    data: {
      nombre: datos.nombre,
      cantidad: datos.cantidad,
      categoriaId: datos.categoriaId,
      fecha,
      notas: datos.notas,
      tipoPresupuesto: datos.tipoPresupuesto,
      fuente: datos.fuente,
      depositoTerceroId: datos.fuente === 'tercero' ? datos.depositoTerceroId : null,
    },
    include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
  });
  if (datos.fuente === 'disponible') {
    await ajustarSaldoDisponible(-datos.cantidad);
  }
  return gasto;
}

/** Borra un GastoVariable y, si tenía un retiro de ahorro vinculado, lo revierte (reintegra el saldo) en la misma transacción. */
export async function eliminarGastoVariable(id: number) {
  const gasto = await prisma.gastoVariable.findUnique({ where: { id } });
  if (!gasto) return;

  if (gasto.movimientoAhorroId && gasto.ahorroLugarId) {
    await prisma.$transaction([
      prisma.gastoVariable.update({ where: { id }, data: { movimientoAhorroId: null } }),
      prisma.movimientoAhorro.delete({ where: { id: gasto.movimientoAhorroId } }),
      prisma.ahorroLugar.update({
        where: { id: gasto.ahorroLugarId },
        data: { saldoActual: { increment: gasto.cantidad } },
      }),
      prisma.gastoVariable.delete({ where: { id } }),
    ]);
    return;
  }

  await prisma.gastoVariable.delete({ where: { id } });
  if (gasto.fuente === 'disponible') {
    await ajustarSaldoDisponible(gasto.cantidad);
  }
}

/** Igual que crearGastoVariable pero para un pago de tarjeta. */
export async function crearPagoTarjeta(datos: {
  tarjetaId: number;
  cantidad: number;
  concepto?: string | null;
  fecha?: Date;
  fuente: FuenteDinero;
  ahorroLugarId?: number | null;
  depositoTerceroId?: number | null;
  compraTarjetaId?: number | null;
}) {
  const fecha = datos.fecha ?? new Date();

  if (datos.fuente === 'ahorro' && datos.ahorroLugarId) {
    return prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoAhorro.create({
        data: {
          ahorroId: datos.ahorroLugarId!,
          tipo: 'retiro',
          cantidad: datos.cantidad,
          concepto: datos.concepto || 'Pago de tarjeta',
          fecha,
          origen: 'pago_tarjeta',
        },
      });
      await tx.ahorroLugar.update({
        where: { id: datos.ahorroLugarId! },
        data: { saldoActual: { decrement: datos.cantidad } },
      });
      return tx.pagoTarjeta.create({
        data: {
          tarjetaId: datos.tarjetaId,
          cantidad: datos.cantidad,
          concepto: datos.concepto || null,
          fecha,
          fuente: 'ahorro',
          ahorroLugarId: datos.ahorroLugarId,
          movimientoAhorroId: movimiento.id,
          compraTarjetaId: datos.compraTarjetaId,
        },
        include: { tarjeta: true, ahorroLugar: true, depositoTercero: true },
      });
    });
  }

  return prisma.pagoTarjeta.create({
    data: {
      tarjetaId: datos.tarjetaId,
      cantidad: datos.cantidad,
      concepto: datos.concepto || null,
      fecha,
      fuente: datos.fuente,
      depositoTerceroId: datos.fuente === 'tercero' ? datos.depositoTerceroId : null,
      compraTarjetaId: datos.compraTarjetaId,
    },
    include: { tarjeta: true, ahorroLugar: true, depositoTercero: true },
  });
}

export async function eliminarPagoTarjeta(id: number) {
  const pago = await prisma.pagoTarjeta.findUnique({ where: { id } });
  if (!pago) return;

  if (pago.movimientoAhorroId && pago.ahorroLugarId) {
    await prisma.$transaction([
      prisma.pagoTarjeta.update({ where: { id }, data: { movimientoAhorroId: null } }),
      prisma.movimientoAhorro.delete({ where: { id: pago.movimientoAhorroId } }),
      prisma.ahorroLugar.update({
        where: { id: pago.ahorroLugarId },
        data: { saldoActual: { increment: pago.cantidad } },
      }),
      prisma.pagoTarjeta.delete({ where: { id } }),
    ]);
    return;
  }

  await prisma.pagoTarjeta.delete({ where: { id } });
}

// --- Materialización de domiciliados en efectivo ---

/** Todos los pares {año, mes} desde `desde` hasta `hasta`, inclusive, en orden. */
function mesesEntre(desde: Date, hasta: Date): { año: number; mes: number }[] {
  const resultado: { año: number; mes: number }[] = [];
  let año = desde.getUTCFullYear();
  let mes = desde.getUTCMonth();
  const añoFin = hasta.getUTCFullYear();
  const mesFin = hasta.getUTCMonth();
  while (año < añoFin || (año === añoFin && mes <= mesFin)) {
    resultado.push({ año, mes });
    mes += 1;
    if (mes > 11) {
      mes = 0;
      año += 1;
    }
  }
  return resultado;
}

interface Ocurrencia {
  cantidad: number;
  fecha: Date;
}

/** Ocurrencias de un gasto/ahorro domiciliado estrictamente después de `desde` y hasta `hasta` (inclusive). */
function ocurrenciasEnRango(
  item: { fechaCobro?: number | null; frecuencia: string; diasSemana?: string | null; cantidad: number },
  desde: Date,
  hasta: Date
): Ocurrencia[] {
  const hastaFin = finDelDia(hasta);

  if (item.frecuencia === 'semanal') {
    return ocurrenciasSemanales(parseDiasSemana(item.diasSemana), item.cantidad, [{ inicio: desde, fin: hasta }]).filter(
      (oc) => oc.fecha > desde && oc.fecha <= hastaFin
    );
  }

  if (item.fechaCobro == null) return [];

  const resultado: Ocurrencia[] = [];
  for (const { año, mes } of mesesEntre(desde, hasta)) {
    ocurrenciasDelMes(item.fechaCobro, item.frecuencia, item.cantidad, año, mes, CORTE_1).forEach((oc) => {
      if (oc.fecha > desde && oc.fecha <= hastaFin) resultado.push(oc);
    });
  }
  return resultado.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

/**
 * Genera los registros reales (GastoVariable / MovimientoAhorro) de los
 * domiciliados en efectivo y de ahorro cuya fecha ya llegó, y avanza su
 * marcador `ultimaOcurrenciaMaterializada`. Idempotente: si ya se
 * materializó hasta hoy, no hace nada. Los gastos domiciliados ligados a una
 * tarjeta (tarjetaId != null) NO se tocan aquí -- esos siguen siendo
 * proyección + checkbox manual ("pagadoAdelantadoHasta").
 */
export async function materializarDomiciliados(): Promise<void> {
  const hoy = hoyMexico();

  const gastosCash = await prisma.gastoDomiciliado.findMany({
    where: { activo: true, tarjetaId: null },
  });

  for (const g of gastosCash) {
    const desde = g.ultimaOcurrenciaMaterializada ?? g.fechaCreacion;
    const pendientes = ocurrenciasEnRango(g, desde, hoy);
    if (pendientes.length === 0) continue;

    await prisma.$transaction([
      ...pendientes.map((oc) =>
        prisma.gastoVariable.create({
          data: {
            nombre: g.nombre,
            cantidad: oc.cantidad,
            categoriaId: g.categoriaId,
            fecha: oc.fecha,
            tipoPresupuesto: g.tipoPresupuesto,
            fuente: 'disponible',
            gastoDomiciliadoOrigenId: g.id,
          },
        })
      ),
      prisma.gastoDomiciliado.update({
        where: { id: g.id },
        data: { ultimaOcurrenciaMaterializada: pendientes[pendientes.length - 1].fecha },
      }),
    ]);
  }

  const ahorros = await prisma.ahorroDomiciliado.findMany({ where: { activo: true } });

  for (const a of ahorros) {
    const desde = a.ultimaOcurrenciaMaterializada ?? a.fechaCreacion;
    const item = {
      fechaCobro: a.frecuencia === 'semanal' ? null : diaMexico(a.fechaInicio),
      frecuencia: a.frecuencia,
      diasSemana: a.diasSemana,
      cantidad: a.cantidad,
    };
    const pendientes = ocurrenciasEnRango(item, desde, hoy);
    if (pendientes.length === 0) continue;

    await prisma.$transaction([
      ...pendientes.map((oc) =>
        prisma.movimientoAhorro.create({
          data: {
            ahorroId: a.ahorroDestinoId,
            tipo: 'deposito',
            cantidad: oc.cantidad,
            concepto: `Ahorro domiciliado: ${a.nombre}`,
            fecha: oc.fecha,
            origen: 'domiciliado',
            ahorroDomiciliadoOrigenId: a.id,
          },
        })
      ),
      prisma.ahorroLugar.update({
        where: { id: a.ahorroDestinoId },
        data: { saldoActual: { increment: pendientes.reduce((s, oc) => s + oc.cantidad, 0) } },
      }),
      prisma.ahorroDomiciliado.update({
        where: { id: a.id },
        data: { ultimaOcurrenciaMaterializada: pendientes[pendientes.length - 1].fecha },
      }),
    ]);
  }
}

/**
 * Ocurrencias de pago de un Ingreso entre `desde` (exclusivo) y `hasta`
 * (inclusive). A diferencia de los gastos domiciliados, un Ingreso no tiene
 * un "día de cobro" propio -- se paga en los mismos cortes que ya usa toda
 * la app para las quincenas (día 10 y 25): quincenal cae en ambos, mensual
 * solo en el día 10. "único" se acredita una sola vez, en su fechaInicio.
 */
function ocurrenciasIngresoEnRango(
  ingreso: { frecuencia: string; fechaInicio: Date; cantidad: number },
  desde: Date,
  hasta: Date
): Ocurrencia[] {
  const hastaFin = finDelDia(hasta);

  if (ingreso.frecuencia === 'unico') {
    const fecha = fechaUTC(
      ingreso.fechaInicio.getUTCFullYear(),
      ingreso.fechaInicio.getUTCMonth(),
      ingreso.fechaInicio.getUTCDate()
    );
    return fecha > desde && fecha <= hastaFin ? [{ cantidad: ingreso.cantidad, fecha }] : [];
  }

  const diasDePago = ingreso.frecuencia === 'quincenal' ? [CORTE_1, CORTE_2] : [CORTE_1];
  const resultado: Ocurrencia[] = [];
  for (const { año, mes } of mesesEntre(desde, hasta)) {
    diasDePago.forEach((dia) => {
      const fecha = fechaUTC(año, mes, dia);
      if (fecha > desde && fecha <= hastaFin) resultado.push({ cantidad: ingreso.cantidad, fecha });
    });
  }
  return resultado.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

/**
 * Acredita al saldo disponible los ingresos cuya fecha de pago ya llegó
 * desde la última vez que se materializó, y avanza su marcador. Idempotente,
 * igual que materializarDomiciliados.
 */
export async function materializarIngresos(): Promise<void> {
  const hoy = hoyMexico();
  const ingresos = await prisma.ingreso.findMany({ where: { activo: true } });

  for (const ing of ingresos) {
    const desde = ing.ultimaOcurrenciaMaterializada ?? ing.fechaCreacion;
    const pendientes = ocurrenciasIngresoEnRango(ing, desde, hoy);
    if (pendientes.length === 0) continue;

    const total = pendientes.reduce((s, oc) => s + oc.cantidad, 0);
    await ajustarSaldoDisponible(total);
    await prisma.ingreso.update({
      where: { id: ing.id },
      data: { ultimaOcurrenciaMaterializada: pendientes[pendientes.length - 1].fecha },
    });
  }
}

// --- Depósitos de terceros ---

type DepositoConRelaciones = Prisma.DepositoTerceroGetPayload<{
  include: { gastosVariables: true; pagosTarjeta: true };
}>;

/** Suma lo ya usado de un depósito (gastos + pagos de tarjeta vinculados). */
export function montoUtilizadoDeposito(deposito: DepositoConRelaciones): number {
  const gastos = deposito.gastosVariables.reduce((s, g) => s + g.cantidad, 0);
  const pagos = deposito.pagosTarjeta.reduce((s, p) => s + p.cantidad, 0);
  return gastos + pagos;
}
