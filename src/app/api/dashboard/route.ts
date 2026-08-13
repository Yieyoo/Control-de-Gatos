// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
  calcularProximaFechaSemanal,
  obtenerPeriodosDelMes,
  calcularPagadoPendiente,
  calcularPagadoPendienteSemanal,
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
  IResumenPeriodo,
} from '@/types';
import type { Ingreso, GastoFijo, GastoDomiciliado, AhorroDomiciliado, GastoVariable } from '@prisma/client';

// Días de pago del usuario: quincena 1 = del 10 al 25; quincena 2 = el resto del mes
const CORTE_1 = 10;
const CORTE_2 = 25;

function construirPeriodo(
  id: 'quincena1' | 'quincena2',
  etiqueta: string,
  rangoTexto: string,
  rangos: RangoFechas[],
  hoy: Date,
  ingresos: Ingreso[],
  gastosFijos: GastoFijo[],
  gastosDomiciliados: GastoDomiciliado[],
  ahorrosDomiciliados: AhorroDomiciliado[],
  gastosVariables: GastoVariable[]
): IResumenPeriodo {
  const ingresosPeriodo = ingresos.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    if (ing.frecuencia === 'quincenal') return sum + ing.cantidad;
    if (ing.frecuencia === 'mensual') return sum + ing.cantidad / 2;
    if (ing.frecuencia === 'unico') {
      return fechaEnRangos(new Date(ing.fechaInicio), rangos) ? sum + ing.cantidad : sum;
    }
    return sum;
  }, 0);

  const fijosManuales = calcularPagadoPendiente(
    gastosFijos.filter((g) => g.activo).map((g) => ({ dia: g.fechaPago, cantidad: g.cantidad })),
    rangos,
    hoy,
    CORTE_1
  );
  const domiciliadosActivos = gastosDomiciliados.filter((g) => g.activo);
  const fijosDomiciliados = calcularPagadoPendiente(
    domiciliadosActivos
      .filter((g) => g.frecuencia !== 'semanal' && g.fechaCobro != null)
      .map((g) => ({ dia: g.fechaCobro as number, frecuencia: g.frecuencia, cantidad: g.cantidad })),
    rangos,
    hoy,
    CORTE_1
  );
  const fijosDomiciliadosSemanales = calcularPagadoPendienteSemanal(
    domiciliadosActivos
      .filter((g) => g.frecuencia === 'semanal')
      .map((g) => ({ diasSemana: parseDiasSemana(g.diasSemana), cantidad: g.cantidad })),
    rangos,
    hoy
  );

  const gastosVariablesPeriodo = gastosVariables.reduce(
    (sum, g) => (fechaEnRangos(new Date(g.fecha), rangos) ? sum + g.cantidad : sum),
    0
  );

  const ahorrosActivos = ahorrosDomiciliados.filter((a) => a.activo);
  const ahorrosNoSemanal = calcularPagadoPendiente(
    ahorrosActivos
      .filter((a) => a.frecuencia !== 'semanal')
      .map((a) => ({ dia: new Date(a.fechaInicio).getDate(), frecuencia: a.frecuencia, cantidad: a.cantidad })),
    rangos,
    hoy,
    CORTE_1
  );
  const ahorrosSemanales = calcularPagadoPendienteSemanal(
    ahorrosActivos
      .filter((a) => a.frecuencia === 'semanal')
      .map((a) => ({ diasSemana: parseDiasSemana(a.diasSemana), cantidad: a.cantidad })),
    rangos,
    hoy
  );

  const gastosFijosPagado = fijosManuales.pagado + fijosDomiciliados.pagado + fijosDomiciliadosSemanales.pagado;
  const gastosFijosPendiente =
    fijosManuales.pendiente + fijosDomiciliados.pendiente + fijosDomiciliadosSemanales.pendiente;
  const ahorroDelMesPagado = ahorrosNoSemanal.pagado + ahorrosSemanales.pagado;
  const ahorroDelMesPendiente = ahorrosNoSemanal.pendiente + ahorrosSemanales.pendiente;

  const dineroDisponible =
    ingresosPeriodo - gastosFijosPagado - gastosVariablesPeriodo - ahorroDelMesPagado;

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

    const quincena1 = construirPeriodo(
      'quincena1',
      `Quincena 1 (${CORTE_1}-${CORTE_2})`,
      `${CORTE_1} - ${CORTE_2}`,
      rangos.quincena1,
      hoy,
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosVariables
    );
    const quincena2 = construirPeriodo(
      'quincena2',
      'Quincena 2 (resto del mes)',
      `1-${CORTE_1 - 1} y ${CORTE_2 + 1}-${ultimoDia}`,
      rangos.quincena2,
      hoy,
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
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
