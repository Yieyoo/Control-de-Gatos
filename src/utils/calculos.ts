// src/utils/calculos.ts
import type { Ingreso, GastoDomiciliado, AhorroDomiciliado, GastoFijo, GastoVariable } from '@prisma/client';

/**
 * Calcula el total de ingresos del mes actual
 */
export function calcularIngresosMes(ingresos: Ingreso[]): number {
  return ingresos.reduce((total, ingreso) => {
    if (!ingreso.activo) return total;
    
    switch (ingreso.frecuencia) {
      case 'mensual':
        return total + ingreso.cantidad;
      case 'quincenal':
        return total + ingreso.cantidad * 2;
      case 'unico': {
        const hoy = new Date();
        const inicio = new Date(ingreso.fechaInicio);
        const esEsteMes = hoy.getMonth() === inicio.getMonth() && hoy.getFullYear() === inicio.getFullYear();
        return esEsteMes ? total + ingreso.cantidad : total;
      }
      default:
        return total;
    }
  }, 0);
}

/**
 * Calcula gastos domiciliados del mes actual
 */
export function calcularGastosDomiciliadosMes(gastos: GastoDomiciliado[]): number {
  return gastos.reduce((total, gasto) => {
    if (!gasto.activo) return total;
    
    switch (gasto.frecuencia) {
      case 'mensual':
        return total + gasto.cantidad;
      case 'quincenal':
        return total + gasto.cantidad * 2;
      default:
        return total;
    }
  }, 0);
}

/**
 * Calcula ahorros domiciliados del mes actual
 */
export function calcularAhorrosDomiciliadosMes(ahorros: AhorroDomiciliado[]): number {
  return ahorros.reduce((total, ahorro) => {
    if (!ahorro.activo) return total;
    
    switch (ahorro.frecuencia) {
      case 'mensual':
        return total + ahorro.cantidad;
      case 'quincenal':
        return total + ahorro.cantidad * 2;
      case 'semanal':
        return total + ahorro.cantidad * 4;
      default:
        return total;
    }
  }, 0);
}

/**
 * Calcula gastos fijos del mes actual
 */
export function calcularGastosFijosMes(gastos: GastoFijo[]): number {
  return gastos.reduce((total, gasto) => {
    if (!gasto.activo) return total;
    return total + gasto.cantidad;
  }, 0);
}

/**
 * Calcula gastos variables de una fecha específica
 */
export function calcularGastosVariablesMes(
  gastos: GastoVariable[],
  fecha: Date = new Date()
): number {
  const mes = fecha.getMonth();
  const año = fecha.getFullYear();
  
  return gastos.reduce((total, gasto) => {
    const gastoMes = new Date(gasto.fecha).getMonth();
    const gastoAño = new Date(gasto.fecha).getFullYear();
    
    return gastoMes === mes && gastoAño === año ? total + gasto.cantidad : total;
  }, 0);
}

/**
 * Calcula el dinero disponible
 */
export function calcularDineroDisponible(
  ingresos: number,
  gastosDomiciliados: number,
  gastosFijos: number,
  gastosVariables: number,
  ahorrosDomiciliados: number
): number {
  return ingresos - gastosDomiciliados - gastosFijos - gastosVariables - ahorrosDomiciliados;
}

/**
 * Calcula próximos movimientos programados (próximos 30 días)
 */
export function calcularMovimientosProgramados(
  gastosDomiciliados: GastoDomiciliado[],
  ahorrosDomiciliados: AhorroDomiciliado[],
  hoy: Date = new Date()
): number {
  const hace30Dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
  let total = 0;

  // Gastos domiciliados
  gastosDomiciliados.forEach((gasto) => {
    if (!gasto.activo) return;
    // Simplificación: asumir que ocurren en la próxima fecha
    total += gasto.cantidad;
  });

  // Ahorros domiciliados
  ahorrosDomiciliados.forEach((ahorro) => {
    if (!ahorro.activo) return;
    total += ahorro.cantidad;
  });

  return total;
}

/**
 * Formatea un número como moneda
 */
export function formatearMoneda(cantidad: number, moneda: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
  }).format(cantidad);
}

/**
 * Calcula porcentaje
 */
export function calcularPorcentaje(parte: number, total: number): number {
  if (total === 0) return 0;
  return (parte / total) * 100;
}
