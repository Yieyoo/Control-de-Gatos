// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
  obtenerPeriodosDelMes,
  calcularPagadoPendiente,
  finDelDia,
} from '@/utils/calculos';
import type {
  IDashboardResumen,
  IGastoPorCategoria,
  IProximoMovimiento,
  IResumenPeriodo,
} from '@/types';
import type { Ingreso, GastoFijo, GastoDomiciliado, AhorroDomiciliado, GastoVariable } from '@prisma/client';

// Día de corte de quincena del usuario: quincena 1 = 1-10, quincena 2 = 11-fin de mes
const CORTE_QUINCENA = 10;

function construirPeriodo(
  id: 'quincena1' | 'quincena2',
  etiqueta: string,
  rango: { inicio: Date; fin: Date },
  hoy: Date,
  ingresos: Ingreso[],
  gastosFijos: GastoFijo[],
  gastosDomiciliados: GastoDomiciliado[],
  ahorrosDomiciliados: AhorroDomiciliado[],
  gastosVariables: GastoVariable[]
): IResumenPeriodo {
  const finRango = finDelDia(rango.fin);

  const ingresosPeriodo = ingresos.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    if (ing.frecuencia === 'quincenal') return sum + ing.cantidad;
    if (ing.frecuencia === 'mensual') return sum + ing.cantidad / 2;
    if (ing.frecuencia === 'unico') {
      const f = new Date(ing.fechaInicio);
      return f >= rango.inicio && f <= finRango ? sum + ing.cantidad : sum;
    }
    return sum;
  }, 0);

  const fijosManuales = calcularPagadoPendiente(
    gastosFijos.filter((g) => g.activo).map((g) => ({ dia: g.fechaPago, cantidad: g.cantidad })),
    rango,
    hoy,
    CORTE_QUINCENA
  );
  const fijosDomiciliados = calcularPagadoPendiente(
    gastosDomiciliados
      .filter((g) => g.activo)
      .map((g) => ({ dia: g.fechaCobro, frecuencia: g.frecuencia, cantidad: g.cantidad })),
    rango,
    hoy,
    CORTE_QUINCENA
  );

  const gastosVariablesPeriodo = gastosVariables.reduce((sum, g) => {
    const f = new Date(g.fecha);
    return f >= rango.inicio && f <= finRango ? sum + g.cantidad : sum;
  }, 0);

  const ahorrosNoSemanal = calcularPagadoPendiente(
    ahorrosDomiciliados
      .filter((a) => a.activo && a.frecuencia !== 'semanal')
      .map((a) => ({ dia: new Date(a.fechaInicio).getDate(), frecuencia: a.frecuencia, cantidad: a.cantidad })),
    rango,
    hoy,
    CORTE_QUINCENA
  );
  const ahorroSemanalPagado = ahorrosDomiciliados
    .filter((a) => a.activo && a.frecuencia === 'semanal')
    .reduce((sum, a) => sum + a.cantidad * 2, 0);

  const gastosFijosPagado = fijosManuales.pagado + fijosDomiciliados.pagado;
  const gastosFijosPendiente = fijosManuales.pendiente + fijosDomiciliados.pendiente;
  const ahorroDelMesPagado = ahorrosNoSemanal.pagado + ahorroSemanalPagado;
  const ahorroDelMesPendiente = ahorrosNoSemanal.pendiente;

  const dineroDisponible =
    ingresosPeriodo - gastosFijosPagado - gastosVariablesPeriodo - ahorroDelMesPagado;

  return {
    id,
    etiqueta,
    inicio: rango.inicio.toISOString(),
    fin: rango.fin.toISOString(),
    ingresos: ingresosPeriodo,
    gastosFijos: gastosFijosPagado,
    gastosFijosPendiente,
    gastosVariables: gastosVariablesPeriodo,
    ahorroDelMes: ahorroDelMesPagado,
    ahorroDelMesPendiente,
    dineroDisponible,
  };
}

function sumarPeriodos(a: IResumenPeriodo, b: IResumenPeriodo, inicio: string, fin: string): IResumenPeriodo {
  return {
    id: 'mes',
    etiqueta: 'Este mes',
    inicio,
    fin,
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
    const rangos = obtenerPeriodosDelMes(hoy, CORTE_QUINCENA);

    const quincena1 = construirPeriodo(
      'quincena1',
      `Quincena 1 (1-${CORTE_QUINCENA})`,
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
      `Quincena 2 (${CORTE_QUINCENA + 1}-fin)`,
      rangos.quincena2,
      hoy,
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosVariables
    );
    const mes = sumarPeriodos(quincena1, quincena2, rangos.mes.inicio.toISOString(), rangos.mes.fin.toISOString());

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
    gastosDomiciliados.forEach((g) =>
      acumular(g.categoriaId, g.categoria, g.frecuencia === 'quincenal' ? g.cantidad * 2 : g.cantidad)
    );
    gastosVariables.forEach((g) => {
      const fecha = new Date(g.fecha);
      if (fecha >= rangos.mes.inicio && fecha <= finDelDia(rangos.mes.fin)) {
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
      proximaFecha: calcularProximaFechaMensual(g.fechaCobro, hoy).toISOString(),
      categoriaColor: g.categoria?.color,
    }));
    const proximosAhorros: IProximoMovimiento[] = ahorrosDomiciliados.map((a) => ({
      id: `ahorro-${a.id}`,
      tipo: 'ahorro_domiciliado' as const,
      nombre: a.nombre,
      cantidad: a.cantidad,
      frecuencia: a.frecuencia,
      proximaFecha: calcularProximaFechaDesdeInicio(new Date(a.fechaInicio), a.frecuencia, hoy).toISOString(),
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
