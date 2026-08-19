// src/lib/finanzas.ts
//
// Orquesta las escrituras que involucran más de una tabla (por ejemplo, un
// gasto pagado con dinero de ahorro también tiene que mover el saldo de esa
// cuenta de ahorro). La lógica de "qué efecto tiene cada movimiento sobre el
// dinero disponible" vive en src/utils/finanzas.ts (puro, testeado); aquí
// solo se decide qué filas crear/borrar en la base de datos. "Dinero
// disponible" ya no se guarda en ningún lado -- se recalcula de cero cada
// vez a partir de las filas reales (ver calcularDineroDisponible en
// src/utils/finanzas.ts, usado desde src/app/api/dashboard/route.ts), así
// que aquí NUNCA hace falta "ajustar" ni "corregir" ningún saldo: basta con
// crear/borrar la fila correcta.

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { IPorcentajesMeta } from '@/types';

export type FuenteDinero = 'disponible' | 'ahorro' | 'tercero';

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

  return prisma.gastoVariable.create({
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

// --- Confirmación de domiciliados (gastos en efectivo y ahorros) ---
//
// Ni un gasto domiciliado en efectivo ni un ahorro domiciliado se registran
// solo porque ya llegó su fecha -- eso asumiría que el movimiento ya ocurrió
// cuando puede que tú lo hagas más tarde, o no lo hagas. Ambos son
// proyección + confirmación manual: quedan pendientes hasta que confirmas
// con un checkbox que el cargo/depósito realmente pasó, y eso es lo que crea
// la fila real. Cada ocurrencia es independiente -- confirmar la de esta
// quincena no marca las anteriores ni las siguientes.

/**
 * Marca una ocurrencia de un gasto domiciliado en efectivo como cobrada: crea
 * el GastoVariable real (fuente="disponible"), fechado exactamente en esa
 * ocurrencia.
 */
export async function confirmarGastoDomiciliado(id: number, fecha: Date) {
  const gasto = await prisma.gastoDomiciliado.findUnique({ where: { id } });
  if (!gasto) return null;

  try {
    return await prisma.gastoVariable.create({
      data: {
        nombre: gasto.nombre,
        cantidad: gasto.cantidad,
        categoriaId: gasto.categoriaId,
        fecha,
        tipoPresupuesto: gasto.tipoPresupuesto,
        fuente: 'disponible',
        gastoDomiciliadoOrigenId: gasto.id,
      },
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
    });
  } catch (error) {
    // Ya se había confirmado esta misma ocurrencia (ej. doble clic en el
    // checkbox) -- la restricción única lo bloqueó; regresamos la fila ya
    // existente en vez de crear otra.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existente = await prisma.gastoVariable.findFirst({
        where: { gastoDomiciliadoOrigenId: id, fecha },
      });
      if (existente) return existente;
    }
    throw error;
  }
}

/** Deshace la confirmación de una ocurrencia específica de un gasto domiciliado en efectivo: borra su GastoVariable real. */
export async function deshacerGastoDomiciliado(id: number, fecha: Date): Promise<void> {
  const gasto = await prisma.gastoVariable.findFirst({
    where: { gastoDomiciliadoOrigenId: id, fecha },
  });
  if (!gasto) return;
  await prisma.gastoVariable.delete({ where: { id: gasto.id } });
}

/**
 * Marca una ocurrencia de un ahorro domiciliado como enviada: crea el
 * MovimientoAhorro real (fechado exactamente en esa ocurrencia) e incrementa
 * el saldo de esa cuenta de ahorro.
 */
export async function confirmarAhorroDomiciliado(id: number, fecha: Date) {
  const ahorro = await prisma.ahorroDomiciliado.findUnique({ where: { id } });
  if (!ahorro) return null;

  try {
    const [movimiento] = await prisma.$transaction([
      prisma.movimientoAhorro.create({
        data: {
          ahorroId: ahorro.ahorroDestinoId,
          tipo: 'deposito',
          cantidad: ahorro.cantidad,
          concepto: `Ahorro domiciliado: ${ahorro.nombre}`,
          fecha,
          origen: 'domiciliado',
          ahorroDomiciliadoOrigenId: ahorro.id,
        },
      }),
      prisma.ahorroLugar.update({
        where: { id: ahorro.ahorroDestinoId },
        data: { saldoActual: { increment: ahorro.cantidad } },
      }),
      prisma.ahorroDomiciliado.update({ where: { id }, data: { enviadoHasta: fecha } }),
    ]);
    return movimiento;
  } catch (error) {
    // Ya se había confirmado esta misma ocurrencia (ej. doble clic en el
    // checkbox) -- la restricción única lo bloqueó antes de tocar los
    // saldos, así que no hay nada que revertir; solo regresamos la fila ya
    // existente en vez de crear otra.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existente = await prisma.movimientoAhorro.findFirst({
        where: { ahorroDomiciliadoOrigenId: id, fecha },
      });
      if (existente) return existente;
    }
    throw error;
  }
}

/** Deshace la confirmación de envío de una ocurrencia específica de un ahorro domiciliado: borra su MovimientoAhorro real y revierte el saldo de ahorro. */
export async function deshacerAhorroDomiciliado(id: number, fecha: Date): Promise<void> {
  const ahorro = await prisma.ahorroDomiciliado.findUnique({ where: { id } });
  if (!ahorro) return;

  const movimiento = await prisma.movimientoAhorro.findFirst({
    where: { ahorroDomiciliadoOrigenId: id, fecha },
  });
  if (!movimiento) return;

  await prisma.$transaction([
    prisma.movimientoAhorro.delete({ where: { id: movimiento.id } }),
    prisma.ahorroLugar.update({
      where: { id: ahorro.ahorroDestinoId },
      data: { saldoActual: { decrement: movimiento.cantidad } },
    }),
    prisma.ahorroDomiciliado.update({ where: { id }, data: { enviadoHasta: null } }),
  ]);
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

// --- % destinado a (metas de necesidades/gustos/ahorro) ---

export const CLAVE_PORCENTAJES_DESTINO = 'porcentajes_destino';
export const PORCENTAJES_DESTINO_DEFECTO: IPorcentajesMeta = { necesidades: 50, gustos: 20, ahorro: 30 };

/** Lee los % que el usuario configuró para "% destinado a" (usa el default si nunca los configuró o el valor guardado es inválido). */
export async function obtenerPorcentajesDestino(): Promise<IPorcentajesMeta> {
  const config = await prisma.configuracion.findUnique({ where: { clave: CLAVE_PORCENTAJES_DESTINO } });
  if (!config) return PORCENTAJES_DESTINO_DEFECTO;
  try {
    const valor = JSON.parse(config.valor);
    if (
      typeof valor?.necesidades === 'number' &&
      typeof valor?.gustos === 'number' &&
      typeof valor?.ahorro === 'number'
    ) {
      return valor;
    }
  } catch {
    // JSON inválido -- se usa el default de abajo
  }
  return PORCENTAJES_DESTINO_DEFECTO;
}
