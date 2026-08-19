// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import { montoUtilizadoDeposito } from '@/lib/finanzas';
import { construirPeriodo, CORTE_1, CORTE_2 } from '@/lib/periodo';
import { gastoNeto, calcularDeudaTarjeta, calcularEstadoDeposito } from '@/utils/finanzas';
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
} from '@/types';

/** Cantidad neta de un gasto/compra ya registrado, restando sus devoluciones. */
function neto(item: { cantidad: number; devoluciones: { cantidad: number }[] }): number {
  return gastoNeto(item.cantidad, item.devoluciones);
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
            (oc) => !g.pagadoAdelantadoHasta || g.pagadoAdelantadoHasta < oc.fecha
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

    // Cada quincena tiene su propio arranque (calcula su "Dinero disponible" a
    // partir de SU ingreso y SUS movimientos reales, ver construirPeriodo). El
    // mes no tiene un cálculo propio para ese número -- es la suma de las dos
    // quincenas, así que se calculan primero y luego se usan para "Mes".
    const quincena1 = construirPeriodo(
      'quincena1',
      'la quincena actual',
      formatearRango(periodoActual),
      [periodoActual],
      true,
      hoy,
      ...args
    );
    const quincena2 = construirPeriodo(
      'quincena2',
      'la próxima quincena',
      formatearRango(periodoProximo),
      [periodoProximo],
      true,
      hoy,
      ...args
    );
    const mes = construirPeriodo('mes', 'Este mes', formatearRango(rangoMes), [rangoMes], false, hoy, ...args);
    mes.dineroDisponible = quincena1.dineroDisponible + quincena2.dineroDisponible;
    mes.dineroReal = mes.dineroDisponible - mes.dineroComprometido;

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

    gastosFijos.forEach((g) => acumular(g.categoriaId, g.categoria, g.cantidad));
    gastosDomiciliados
      .filter((g) => g.activo && g.tarjetaId != null)
      .forEach((g) => {
        if (g.frecuencia === 'semanal') {
          const ocurrencias = ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, [rangoMes]);
          acumular(g.categoriaId, g.categoria, ocurrencias.reduce((sum, oc) => sum + oc.cantidad, 0));
        } else {
          acumular(g.categoriaId, g.categoria, g.frecuencia === 'quincenal' ? g.cantidad * 2 : g.cantidad);
        }
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
