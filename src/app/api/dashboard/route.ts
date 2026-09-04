// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import { montoUtilizadoDeposito, obtenerPorcentajesDestino } from '@/lib/finanzas';
import { construirPeriodo, CORTE_1, CORTE_2 } from '@/lib/periodo';
import { gastoNeto, calcularDeudaTarjeta, calcularEstadoDeposito, calcularDineroDisponible } from '@/utils/finanzas';
import {
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
  calcularProximaFechaSemanal,
  rangoMesActual,
  periodoQuincenaActual,
  periodoQuincenaSiguiente,
  cicloTarjetaActual,
  ocurrenciasDeGastoEnRangos,
  ocurrenciasSemanales,
  parseDiasSemana,
  fechaEnRangos,
  formatearDiaMes,
  hoyMexico,
  type RangoFechas,
} from '@/utils/calculos';
import type {
  IDashboardResumen,
  IGastoPorCategoria,
  IProximoMovimiento,
  IDeudaTarjeta,
  IAhorroLugar,
  IFuenteDinero,
  IResumenPeriodo,
} from '@/types';
import type { Ingreso } from '@prisma/client';

/** Cantidad neta de un gasto/compra ya registrado, restando sus devoluciones. */
function neto(item: { cantidad: number; devoluciones: { cantidad: number }[] }): number {
  return gastoNeto(item.cantidad, item.devoluciones);
}

/**
 * Cuántas quincenas completas ya "cerraron" (terminaron del todo) entre el
 * inicio del tracking (la fecha de inicio del ingreso más antiguo) y el
 * inicio de un periodo dado -- Ingreso no tiene un día de pago propio, así
 * que su monto se prorratea por quincena completa (igual que en
 * construirPeriodo). Se compara el FIN de cada quincena (no su inicio)
 * contra `inicioPeriodo`: cuando `inicioPeriodo` es el 1º de un mes de
 * calendario (no un corte de quincena), una quincena puede empezar antes
 * pero terminar después de esa fecha (ej. la quincena 25 ago-9 sep cruza a
 * septiembre) -- esa quincena todavía no "cerró" antes del mes, así que no
 * cuenta. Si `inicioReal` cae a la mitad de una quincena, esa quincena
 * parcial tampoco cuenta (mejor subestimar el sobrante que inventar ingreso
 * de antes de que existiera el registro).
 */
function contarQuincenasAntes(inicioReal: Date, inicioPeriodo: Date): number {
  let cursor = periodoQuincenaActual(inicioReal, CORTE_1, CORTE_2);
  if (cursor.inicio < inicioReal) cursor = periodoQuincenaSiguiente(cursor, CORTE_1, CORTE_2);
  let n = 0;
  while (cursor.fin < inicioPeriodo && n < 120) {
    n++;
    cursor = periodoQuincenaSiguiente(cursor, CORTE_1, CORTE_2);
  }
  return n;
}

/**
 * Lo que sobra de todo lo anterior a que empiece `periodo` (una quincena o el
 * mes de calendario) -- el punto de partida ("extra") de ese periodo (ver
 * combinarConExtra). Se deriva de las filas reales (nunca se guarda), igual
 * que el resto de "Dinero disponible".
 */
function calcularExtraAntesDe(
  periodo: RangoFechas,
  ingresos: Ingreso[],
  gastosVariables: { cantidad: number; fuente: string; fecha: Date; devoluciones: { cantidad: number }[] }[],
  pagosTarjeta: { cantidad: number; fuente: string; fecha: Date }[],
  movimientosAhorro: { cantidad: number; tipo: string; origen: string; fecha: Date }[]
): number {
  const activos = ingresos.filter((i) => i.activo);
  if (activos.length === 0) return 0;

  const inicioReal = new Date(Math.min(...activos.map((i) => new Date(i.fechaInicio).getTime())));
  if (inicioReal >= periodo.inicio) return 0;

  const numQuincenas = contarQuincenasAntes(inicioReal, periodo.inicio);
  const rangoAntes: RangoFechas = { inicio: inicioReal, fin: new Date(periodo.inicio.getTime() - 1) };

  const ingresoAntes = activos.reduce((sum, ing) => {
    if (ing.frecuencia === 'quincenal') return sum + ing.cantidad * numQuincenas;
    if (ing.frecuencia === 'mensual') return sum + (ing.cantidad / 2) * numQuincenas;
    if (ing.frecuencia === 'unico') {
      return fechaEnRangos(new Date(ing.fechaInicio), [rangoAntes]) ? sum + ing.cantidad : sum;
    }
    return sum;
  }, 0);

  const antes = (fecha: Date) => fecha >= inicioReal && fecha < periodo.inicio;

  return calcularDineroDisponible({
    ingresoAcumulado: ingresoAntes,
    gastosVariables: gastosVariables
      .filter((g) => g.fuente !== 'tercero' && antes(new Date(g.fecha)))
      .map((g) => ({ cantidad: g.cantidad, fuente: g.fuente as IFuenteDinero, devoluciones: g.devoluciones })),
    pagosTarjeta: pagosTarjeta
      .filter((p) => antes(new Date(p.fecha)))
      .map((p) => ({ cantidad: p.cantidad, fuente: p.fuente as IFuenteDinero })),
    movimientosAhorro: movimientosAhorro
      .filter((m) => antes(new Date(m.fecha)))
      .map((m) => ({
        cantidad: m.cantidad,
        tipo: m.tipo as 'deposito' | 'retiro',
        origen: m.origen as 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta',
      })),
  });
}

/**
 * Aplica el sobrante de periodos anteriores ("extra") a un periodo ya
 * calculado: el extra se gasta primero (regla elegida por el usuario) -- se
 * va agotando con cada gasto de este periodo antes de tocar su propio
 * ingreso, y solo cuando se agota empieza a bajar el ingreso del periodo. El
 * total (dineroDisponible) es el mismo sin importar el orden; `extra` es solo
 * cuánto de ese total sigue siendo sobrante sin tocar, para mostrarlo aparte.
 */
function combinarConExtra(periodo: IResumenPeriodo, extraInicial: number): IResumenPeriodo {
  const extraClamped = Math.max(0, extraInicial);
  const gastadoEnPeriodo = periodo.ingresos - periodo.dineroDisponible;
  const extra = Math.min(extraClamped, Math.max(0, extraClamped - gastadoEnPeriodo));
  const dineroDisponible = periodo.dineroDisponible + extraClamped;
  const dineroReal = dineroDisponible - periodo.dineroComprometido;
  return { ...periodo, dineroDisponible, dineroReal, extra };
}

export async function GET() {
  try {
    const [
      ingresos,
      ahorrosLugares,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosFijos,
      gastosVariables,
      tarjetas,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro,
      depositosTerceros,
      metas,
    ] = await Promise.all([
      prisma.ingreso.findMany({ where: { activo: true } }),
      prisma.ahorroLugar.findMany(),
      prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
      prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.gastoVariable.findMany({ include: { categoria: true, devoluciones: true } }),
      prisma.tarjetaCredito.findMany({ where: { activa: true } }),
      prisma.compraTarjeta.findMany({ include: { categoria: true, devoluciones: true } }),
      prisma.pagoTarjeta.findMany(),
      prisma.movimientoAhorro.findMany(),
      prisma.depositoTercero.findMany({ include: { gastosVariables: true, pagosTarjeta: true } }),
      obtenerPorcentajesDestino(),
    ]);

    const hoy = hoyMexico();

    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);
    const dineroTerceroPendiente = depositosTerceros.reduce(
      (sum, d) => sum + calcularEstadoDeposito(d.cantidad, montoUtilizadoDeposito(d)).pendiente,
      0
    );

    const rangoMes = rangoMesActual(hoy);
    const periodoActual = periodoQuincenaActual(hoy, CORTE_1, CORTE_2);
    const periodoProximo = periodoQuincenaSiguiente(periodoActual, CORTE_1, CORTE_2);

    // Ocurrencias de cargos domiciliados de tarjeta que ya se confirmaron con
    // un monto real (ver confirmarCargoTarjetaDomiciliado) -- esas ya cuentan
    // en `comprado` vía su CompraTarjeta real, así que no deben contarse
    // TAMBIÉN como pendientes aquí. No se puede usar solo
    // `pagadoAdelantadoHasta` para esto: ese marcador es "pagado hasta la
    // fecha X" (válido para cargos fijos tipo Netflix, que se pagan en
    // orden), pero un cargo de monto variable (gasolina) no es así -- cada
    // ocurrencia es independiente, y usar el marcador aquí "pagaba" también
    // ocurrencias anteriores sin compra real de por medio.
    const cargosConCompraReal = new Set(
      comprasTarjeta
        .filter((c) => c.gastoDomiciliadoOrigenId != null)
        .map((c) => `${c.gastoDomiciliadoOrigenId}|${new Date(c.fecha).getTime()}`)
    );

    // Deuda de tarjetas: todo lo que llevas comprado (haya cortado o no, incluye MSI
    // completo), menos devoluciones, más los gastos domiciliados ligados a esta
    // tarjeta que ya cayeron y no se marcaron como pagados, menos lo que ya abonaste.
    const deudaTarjetas: IDeudaTarjeta[] = tarjetas.map((t) => {
      const comprado = comprasTarjeta
        .filter((c) => c.tarjetaId === t.id)
        .reduce((sum, c) => sum + neto(c), 0);
      const pagado = pagosTarjeta
        .filter((p) => p.tarjetaId === t.id)
        .reduce((sum, p) => sum + p.cantidad, 0);

      const cicloActualTarjeta = cicloTarjetaActual(hoy, t.diaCorte);
      const cargosDomiciliados = gastosDomiciliados
        .filter((g) => g.activo && g.tarjetaId === t.id)
        .reduce((sum, g) => {
          const ocurrencias = ocurrenciasDeGastoEnRangos(g, [cicloActualTarjeta], CORTE_1);
          const pendientes = ocurrencias.filter(
            (oc) =>
              !cargosConCompraReal.has(`${g.id}|${oc.fecha.getTime()}`) &&
              (!g.pagadoAdelantadoHasta || g.pagadoAdelantadoHasta < oc.fecha)
          );
          return sum + pendientes.reduce((s, oc) => s + oc.cantidad, 0);
        }, 0);

      const debe = calcularDeudaTarjeta(comprado, pagado, cargosDomiciliados);
      return {
        id: t.id,
        nombre: t.nombre,
        debe,
        pagoQuincenal: t.pagoQuincenal ?? undefined,
        diaCorte: t.diaCorte,
      };
    });
    const deudaTarjetasTotal = deudaTarjetas.reduce((sum, t) => sum + t.debe, 0);

    const args = [
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosVariables,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro,
    ] as const;

    // Cada periodo (quincena1, quincena2, y también "mes") calcula primero su
    // "Dinero disponible" propio (SU ingreso menos SUS movimientos reales
    // dentro de SU propia ventana de fechas, ver construirPeriodo) y luego se
    // le suma el sobrante ("extra") acumulado antes de que ese periodo
    // empezara -- se va gastando primero ese extra antes de tocar el ingreso
    // propio (ver combinarConExtra). Para quincena1/quincena2 ese extra se
    // encadena (lo que sobra de quincena1 es el extra de quincena2); "Mes"
    // usa su propio extra, acumulado desde antes del día 1 del mes, para que
    // Dinero disponible/real de "Mes" quede acotado al mismo calendario (1 al
    // último día) que Gastos fijos/variables/ahorro de esa misma tarjeta, en
    // vez de reflejar fechas de la quincena próxima que ya no son "este mes".
    const extraAntesDeQuincena1 = calcularExtraAntesDe(
      periodoActual,
      ingresos,
      gastosVariables,
      pagosTarjeta,
      movimientosAhorro
    );
    const quincena1 = combinarConExtra(
      construirPeriodo('quincena1', 'la quincena actual', formatearRango(periodoActual), [periodoActual], true, hoy, ...args, metas),
      extraAntesDeQuincena1
    );
    const quincena2 = combinarConExtra(
      construirPeriodo('quincena2', 'la próxima quincena', formatearRango(periodoProximo), [periodoProximo], true, hoy, ...args, metas),
      quincena1.dineroDisponible
    );
    const extraAntesDelMes = calcularExtraAntesDe(rangoMes, ingresos, gastosVariables, pagosTarjeta, movimientosAhorro);
    const mes = combinarConExtra(
      construirPeriodo('mes', 'Este mes', formatearRango(rangoMes), [rangoMes], false, hoy, ...args, metas),
      extraAntesDelMes
    );

    // Gastos por categoría del mes (fijos + domiciliados de tarjeta (proyección) +
    // reales del mes: variables manuales/confirmados + compras de tarjeta).
    // Los domiciliados EN EFECTIVO ya no se proyectan aquí -- ya están en
    // `gastosVariables` (una vez confirmados) para evitar contarlos dos veces.
    const montosPorCategoria = new Map<number, { nombre: string; color: string; monto: number }>();
    const acumular = (
      categoriaId: number | null | undefined,
      categoria: { nombre: string; color: string } | null | undefined,
      monto: number
    ) => {
      if (!categoriaId || !categoria) return;
      const actual = montosPorCategoria.get(categoriaId);
      if (actual) {
        actual.monto += monto;
      } else {
        montosPorCategoria.set(categoriaId, { nombre: categoria.nombre, color: categoria.color, monto });
      }
    };

    // Ocurrencias de cargos domiciliados de tarjeta que ya se confirmaron con
    // un monto real (ej. gasolina, ver confirmarCargoTarjetaDomiciliado) --
    // esa CompraTarjeta ya se suma más abajo con `comprasTarjeta.forEach`, así
    // que aquí se excluyen para no contarlas dos veces (una como proyección
    // estimada y otra como la compra real).
    const comprasConfirmadasKeys = new Set(
      comprasTarjeta
        .filter((c) => c.gastoDomiciliadoOrigenId != null)
        .map((c) => `${c.gastoDomiciliadoOrigenId}|${new Date(c.fecha).getTime()}`)
    );

    gastosFijos.forEach((g) => acumular(g.categoriaId, g.categoria, g.cantidad));
    gastosDomiciliados
      .filter((g) => g.activo && g.tarjetaId != null)
      .forEach((g) => {
        // Ocurrencias reales dentro del mes (no un estimado de "quincenal =
        // 2 veces siempre"), y sin las que ya tienen compra real.
        const ocurrencias = (
          g.frecuencia === 'semanal'
            ? ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, [rangoMes])
            : ocurrenciasDeGastoEnRangos(g, [rangoMes], CORTE_1)
        ).filter((oc) => !comprasConfirmadasKeys.has(`${g.id}|${oc.fecha.getTime()}`));
        acumular(g.categoriaId, g.categoria, ocurrencias.reduce((sum, oc) => sum + oc.cantidad, 0));
      });
    gastosVariables.forEach((g) => {
      if (g.fuente !== 'tercero' && fechaEnRangos(new Date(g.fecha), [rangoMes])) {
        acumular(g.categoriaId, g.categoria, neto(g));
      }
    });
    comprasTarjeta.forEach((c) => {
      if (fechaEnRangos(new Date(c.fecha), [rangoMes])) {
        acumular(c.categoriaId, c.categoria, neto(c));
      }
    });

    const totalGastos = Array.from(montosPorCategoria.values()).reduce((sum, c) => sum + c.monto, 0);
    const gastosPorCategoria: IGastoPorCategoria[] = Array.from(montosPorCategoria.entries())
      .map(([categoriaId, datos]) => ({
        categoriaId,
        nombre: datos.nombre,
        color: datos.color,
        monto: datos.monto,
        porcentaje: totalGastos > 0 ? (datos.monto / totalGastos) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto);

    // Próximos movimientos (más cercanos primero)
    const proximosGastos: IProximoMovimiento[] = gastosDomiciliados.map((g) => ({
      id: `gasto-${g.id}`,
      tipo: 'gasto_domiciliado' as const,
      nombre: g.nombre,
      cantidad: g.cantidad,
      frecuencia: g.frecuencia,
      proximaFecha: (
        g.frecuencia === 'semanal'
          ? calcularProximaFechaSemanal(parseDiasSemana(g.diasSemana), hoy)
          : calcularProximaFechaMensual(g.fechaCobro ?? 1, hoy)
      ).toISOString(),
      categoriaColor: g.categoria?.color,
    }));
    const proximosAhorros: IProximoMovimiento[] = ahorrosDomiciliados.map((a) => ({
      id: `ahorro-${a.id}`,
      tipo: 'ahorro_domiciliado' as const,
      nombre: a.nombre,
      cantidad: a.cantidad,
      frecuencia: a.frecuencia,
      proximaFecha: (
        a.frecuencia === 'semanal'
          ? calcularProximaFechaSemanal(parseDiasSemana(a.diasSemana), hoy)
          : calcularProximaFechaDesdeInicio(new Date(a.fechaInicio), a.frecuencia, hoy)
      ).toISOString(),
    }));
    const proximosMovimientos = [...proximosGastos, ...proximosAhorros]
      .sort((a, b) => new Date(a.proximaFecha).getTime() - new Date(b.proximaFecha).getTime())
      .slice(0, 5);

    const resumen: IDashboardResumen = {
      ahorroTotal,
      ahorrosLugares: ahorrosLugares.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        tipo: a.tipo as IAhorroLugar['tipo'],
        saldoActual: a.saldoActual,
        notas: a.notas ?? undefined,
        fechaCreacion: a.fechaCreacion,
      })),
      deudaTarjetas,
      deudaTarjetasTotal,
      dineroTerceroPendiente,
      gastosPorCategoria,
      proximosMovimientos,
      periodos: { mes, quincena1, quincena2 },
    };

    return Response.json(resumen);
  } catch (error) {
    console.error('Error en dashboard:', error);
    return Response.json({ error: 'Error al calcular el dashboard' }, { status: 500 });
  }
}

function formatearRango(rango: RangoFechas): string {
  return `${formatearDiaMes(rango.inicio)} - ${formatearDiaMes(rango.fin)}`;
}
