// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
  calcularProximaFechaSemanal,
  obtenerPeriodosDelMes,
  ocurrenciasDelMes,
  ocurrenciasSemanales,
  parseDiasSemana,
  finDelDia,
  fechaEnRangos,
  type RangoFechas,
} from '@/utils/calculos';
import type {
  IDashboardResumen,
  IGastoPorCategoria,
  IProximoMovimiento,
  IMovimientoPeriodo,
  IResumenPeriodo,
} from '@/types';
import type { Ingreso, Prisma } from '@prisma/client';

type GastoFijoConCategoria = Prisma.GastoFijoGetPayload<{ include: { categoria: true } }>;
type GastoDomiciliadoConCategoria = Prisma.GastoDomiciliadoGetPayload<{ include: { categoria: true } }>;
type GastoVariableConCategoria = Prisma.GastoVariableGetPayload<{ include: { categoria: true } }>;
type AhorroDomiciliado = Prisma.AhorroDomiciliadoGetPayload<Record<string, never>>;

// Días de pago del usuario: quincena 1 = del 10 al 25; quincena 2 = el resto del mes
const CORTE_1 = 10;
const CORTE_2 = 25;

interface OcurrenciaTag {
  nombre: string;
  cantidad: number;
  fecha: Date;
  tipo: 'gasto' | 'ahorro';
  categoriaColor?: string;
}

function construirOcurrenciasDelMes(
  hoy: Date,
  gastosFijos: GastoFijoConCategoria[],
  gastosDomiciliados: GastoDomiciliadoConCategoria[],
  ahorrosDomiciliados: AhorroDomiciliado[],
  rangoMes: RangoFechas[]
): OcurrenciaTag[] {
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const resultado: OcurrenciaTag[] = [];

  gastosFijos
    .filter((g) => g.activo)
    .forEach((g) => {
      ocurrenciasDelMes(g.fechaPago, 'mensual', g.cantidad, año, mes, CORTE_1).forEach((oc) =>
        resultado.push({ nombre: g.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'gasto', categoriaColor: g.categoria.color })
      );
    });

  gastosDomiciliados
    .filter((g) => g.activo)
    .forEach((g) => {
      if (g.frecuencia === 'semanal') {
        ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, rangoMes).forEach((oc) =>
          resultado.push({ nombre: g.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'gasto', categoriaColor: g.categoria.color })
        );
      } else if (g.fechaCobro != null) {
        ocurrenciasDelMes(g.fechaCobro, g.frecuencia, g.cantidad, año, mes, CORTE_1).forEach((oc) =>
          resultado.push({ nombre: g.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'gasto', categoriaColor: g.categoria.color })
        );
      }
    });

  ahorrosDomiciliados
    .filter((a) => a.activo)
    .forEach((a) => {
      if (a.frecuencia === 'semanal') {
        ocurrenciasSemanales(parseDiasSemana(a.diasSemana), a.cantidad, rangoMes).forEach((oc) =>
          resultado.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' })
        );
      } else {
        ocurrenciasDelMes(new Date(a.fechaInicio).getDate(), a.frecuencia, a.cantidad, año, mes, CORTE_1).forEach((oc) =>
          resultado.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' })
        );
      }
    });

  return resultado;
}

function construirPeriodo(
  id: 'quincena1' | 'quincena2',
  etiqueta: string,
  rangoTexto: string,
  rangos: RangoFechas[],
  hoy: Date,
  ingresos: Ingreso[],
  ocurrenciasMes: OcurrenciaTag[],
  gastosVariables: GastoVariableConCategoria[]
): IResumenPeriodo {
  const hoyFinDelDia = finDelDia(hoy);

  const ingresosPeriodo = ingresos.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    if (ing.frecuencia === 'quincenal') return sum + ing.cantidad;
    if (ing.frecuencia === 'mensual') return sum + ing.cantidad / 2;
    if (ing.frecuencia === 'unico') {
      return fechaEnRangos(new Date(ing.fechaInicio), rangos) ? sum + ing.cantidad : sum;
    }
    return sum;
  }, 0);

  const ocurrenciasEnPeriodo = ocurrenciasMes.filter((oc) => fechaEnRangos(oc.fecha, rangos));
  const gastosVariablesEnPeriodo = gastosVariables.filter((g) => fechaEnRangos(new Date(g.fecha), rangos));

  const sumar = (ocs: OcurrenciaTag[], pagado: boolean) =>
    ocs.filter((oc) => (oc.fecha <= hoyFinDelDia) === pagado).reduce((s, oc) => s + oc.cantidad, 0);

  const gastoOcurrencias = ocurrenciasEnPeriodo.filter((oc) => oc.tipo === 'gasto');
  const ahorroOcurrencias = ocurrenciasEnPeriodo.filter((oc) => oc.tipo === 'ahorro');

  const gastosFijosPagado = sumar(gastoOcurrencias, true);
  const gastosFijosPendiente = sumar(gastoOcurrencias, false);
  const ahorroDelMesPagado = sumar(ahorroOcurrencias, true);
  const ahorroDelMesPendiente = sumar(ahorroOcurrencias, false);
  const gastosVariablesPeriodo = gastosVariablesEnPeriodo.reduce((s, g) => s + g.cantidad, 0);

  const dineroDisponible = ingresosPeriodo - gastosFijosPagado - gastosVariablesPeriodo - ahorroDelMesPagado;

  const movimientos: IMovimientoPeriodo[] = [
    ...ocurrenciasEnPeriodo.map((oc) => ({
      nombre: oc.nombre,
      cantidad: oc.cantidad,
      fecha: oc.fecha.toISOString(),
      tipo: oc.tipo,
      pagado: oc.fecha <= hoyFinDelDia,
      categoriaColor: oc.categoriaColor,
    })),
    ...gastosVariablesEnPeriodo.map((g) => ({
      nombre: g.nombre,
      cantidad: g.cantidad,
      fecha: new Date(g.fecha).toISOString(),
      tipo: 'gasto' as const,
      pagado: true,
      categoriaColor: g.categoria.color,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    id,
    etiqueta,
    inicio: rangos[0].inicio.toISOString(),
    fin: rangos[rangos.length - 1].fin.toISOString(),
    rangoTexto,
    ingresos: ingresosPeriodo,
    gastosFijos: gastosFijosPagado,
    gastosFijosPendiente,
    gastosVariables: gastosVariablesPeriodo,
    ahorroDelMes: ahorroDelMesPagado,
    ahorroDelMesPendiente,
    dineroDisponible,
    movimientos,
  };
}

function sumarPeriodos(a: IResumenPeriodo, b: IResumenPeriodo, rangoTexto: string): IResumenPeriodo {
  return {
    id: 'mes',
    etiqueta: 'Este mes',
    inicio: a.inicio,
    fin: a.fin,
    rangoTexto,
    ingresos: a.ingresos + b.ingresos,
    gastosFijos: a.gastosFijos + b.gastosFijos,
    gastosFijosPendiente: a.gastosFijosPendiente + b.gastosFijosPendiente,
    gastosVariables: a.gastosVariables + b.gastosVariables,
    ahorroDelMes: a.ahorroDelMes + b.ahorroDelMes,
    ahorroDelMesPendiente: a.ahorroDelMesPendiente + b.ahorroDelMesPendiente,
    dineroDisponible: a.dineroDisponible + b.dineroDisponible,
    movimientos: [...a.movimientos, ...b.movimientos].sort(
      (x, y) => new Date(x.fecha).getTime() - new Date(y.fecha).getTime()
    ),
  };
}

export async function GET() {
  try {
    const [ingresos, ahorrosLugares, gastosDomiciliados, ahorrosDomiciliados, gastosFijos, gastosVariables] =
      await Promise.all([
        prisma.ingreso.findMany({ where: { activo: true } }),
        prisma.ahorroLugar.findMany(),
        prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
        prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.gastoVariable.findMany({ include: { categoria: true } }),
      ]);

    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);

    const hoy = new Date();
    const rangos = obtenerPeriodosDelMes(hoy, CORTE_1, CORTE_2);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    const ocurrenciasMes = construirOcurrenciasDelMes(
      hoy,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      rangos.mes
    );

    const quincena1 = construirPeriodo(
      'quincena1',
      `Quincena 1 (${CORTE_1}-${CORTE_2})`,
      `${CORTE_1} - ${CORTE_2}`,
      rangos.quincena1,
      hoy,
      ingresos,
      ocurrenciasMes,
      gastosVariables
    );
    const quincena2 = construirPeriodo(
      'quincena2',
      'Quincena 2 (resto del mes)',
      `1-${CORTE_1 - 1} y ${CORTE_2 + 1}-${ultimoDia}`,
      rangos.quincena2,
      hoy,
      ingresos,
      ocurrenciasMes,
      gastosVariables
    );
    const mes = sumarPeriodos(quincena1, quincena2, `1 - ${ultimoDia}`);

    // Gastos por categoría del mes (fijos + domiciliados en su equivalente mensual + variables de este mes)
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
    gastosDomiciliados.forEach((g) => {
      if (g.frecuencia === 'semanal') {
        const ocurrencias = ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, rangos.mes);
        acumular(g.categoriaId, g.categoria, ocurrencias.reduce((sum, oc) => sum + oc.cantidad, 0));
      } else {
        acumular(g.categoriaId, g.categoria, g.frecuencia === 'quincenal' ? g.cantidad * 2 : g.cantidad);
      }
    });
    gastosVariables.forEach((g) => {
      if (fechaEnRangos(new Date(g.fecha), rangos.mes)) {
        acumular(g.categoriaId, g.categoria, g.cantidad);
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
