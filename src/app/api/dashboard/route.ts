// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularIngresosMes,
  calcularGastosDomiciliadosMes,
  calcularAhorrosDomiciliadosMes,
  calcularGastosFijosMes,
  calcularGastosVariablesMes,
  calcularDineroDisponible,
  calcularMovimientosProgramados,
} from '@/utils/calculos';
import type { IDashboardResumen } from '@/types';

export async function GET() {
  try {
    // Obtener todos los datos necesarios
    const [ingresos, ahorrosLugares, gastosDomiciliados, ahorrosDomiciliados, gastosFijos, gastosVariables] =
      await Promise.all([
        prisma.ingreso.findMany({ where: { activo: true } }),
        prisma.ahorroLugar.findMany(),
        prisma.gastoDomiciliado.findMany({ where: { activo: true } }),
        prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
        prisma.gastoFijo.findMany({ where: { activo: true } }),
        prisma.gastoVariable.findMany(),
      ]);

    // Calcular totales
    const ingresosTotales = calcularIngresosMes(ingresos);
    const gastosDomiciliadosMes = calcularGastosDomiciliadosMes(gastosDomiciliados);
    const ahorrosDomiciliadosMes = calcularAhorrosDomiciliadosMes(ahorrosDomiciliados);
    const gastosFijosMes = calcularGastosFijosMes(gastosFijos);
    const gastosVariablesMes = calcularGastosVariablesMes(gastosVariables);

    // Ahorro total
    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);

    // Dinero disponible
    const dineroDisponible = calcularDineroDisponible(
      ingresosTotales,
      gastosDomiciliadosMes,
      gastosFijosMes,
      gastosVariablesMes,
      ahorrosDomiciliadosMes
    );

    // Movimientos programados
    const comprometido = calcularMovimientosProgramados(gastosDomiciliados, ahorrosDomiciliados);

    const resumen: IDashboardResumen = {
      ingresosTotales,
      gastosFijos: gastosFijosMes + gastosDomiciliadosMes,
      gastosVariables: gastosVariablesMes,
      ahorroTotal,
      ahorroDelMes: ahorrosDomiciliadosMes,
      dineroDisponible,
      comprometido,
    };

    return Response.json(resumen);
  } catch (error) {
    console.error('Error en dashboard:', error);
    return Response.json({ error: 'Error al calcular el dashboard' }, { status: 500 });
  }
}
