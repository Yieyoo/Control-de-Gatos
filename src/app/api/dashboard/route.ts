// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularIngresosMes,
  calcularGastosDomiciliadosMes,
  calcularAhorrosDomiciliadosMes,
  calcularGastosFijosMes,
  calcularGastosVariablesMes,
  calcularDineroDisponible,
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
} from '@/utils/calculos';
import type { IDashboardResumen, IGastoPorCategoria, IProximoMovimiento } from '@/types';

export async function GET() {
  try {
    // Obtener todos los datos necesarios
    const [ingresos, ahorrosLugares, gastosDomiciliados, ahorrosDomiciliados, gastosFijos, gastosVariables] =
      await Promise.all([
        prisma.ingreso.findMany({ where: { activo: true } }),
        prisma.ahorroLugar.findMany(),
        prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
        prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.gastoVariable.findMany({ include: { categoria: true } }),
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

    // Gastos por categoría (fijos + domiciliados en su equivalente mensual + variables de este mes)
    const montosPorCategoria = new Map<number, { nombre: string; color: string; monto: number }>();
    const acumular = (categoriaId: number | null | undefined, categoria: { nombre: string; color: string } | null | undefined, monto: number) => {
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
    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();
    gastosVariables.forEach((g) => {
      const fecha = new Date(g.fecha);
      if (fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual) {
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
    const hoy = new Date();
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
      ingresosTotales,
      gastosFijos: gastosFijosMes + gastosDomiciliadosMes,
      gastosVariables: gastosVariablesMes,
      ahorroTotal,
      ahorroDelMes: ahorrosDomiciliadosMes,
      dineroDisponible,
      gastosPorCategoria,
      proximosMovimientos,
    };

    return Response.json(resumen);
  } catch (error) {
    console.error('Error en dashboard:', error);
    return Response.json({ error: 'Error al calcular el dashboard' }, { status: 500 });
  }
}
