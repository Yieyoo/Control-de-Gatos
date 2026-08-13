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
 * Calcula la próxima fecha en que cae un día fijo del mes (ej. "se cobra el día 15").
 * Si ese día ya pasó este mes, regresa la del mes siguiente. Si el mes no tiene
 * ese día (ej. 31 en febrero), usa el último día del mes.
 */
export function calcularProximaFechaMensual(diaDelMes: number, hoy: Date = new Date()): Date {
  const intentar = (año: number, mes: number) => {
    const ultimoDiaDelMes = new Date(año, mes + 1, 0).getDate();
    return new Date(año, mes, Math.min(diaDelMes, ultimoDiaDelMes));
  };

  const esteMes = intentar(hoy.getFullYear(), hoy.getMonth());
  if (esteMes >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    return esteMes;
  }
  return intentar(hoy.getFullYear(), hoy.getMonth() + 1);
}

/**
 * Calcula la próxima fecha de un movimiento recurrente que se define por una
 * fecha de inicio + frecuencia (ej. ahorros domiciliados), avanzando desde el
 * inicio hasta encontrar la primera ocurrencia igual o posterior a hoy.
 */
export function calcularProximaFechaDesdeInicio(
  fechaInicio: Date,
  frecuencia: string,
  hoy: Date = new Date()
): Date {
  const diasPorFrecuencia: Record<string, number> = {
    semanal: 7,
    quincenal: 15,
    mensual: 30,
  };
  const pasoDias = diasPorFrecuencia[frecuencia] ?? 30;

  let proxima = new Date(fechaInicio);
  const hoyInicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (proxima >= hoyInicioDelDia) return proxima;

  const msPorPaso = pasoDias * 24 * 60 * 60 * 1000;
  const pasosFaltantes = Math.ceil((hoyInicioDelDia.getTime() - proxima.getTime()) / msPorPaso);
  proxima = new Date(proxima.getTime() + pasosFaltantes * msPorPaso);

  return proxima;
}

/**
 * Rango de fechas de cada período del mes actual: quincena 1 (día 1 al corte),
 * quincena 2 (corte+1 al último día) y el mes completo. quincena1 + quincena2 = mes.
 */
export function obtenerPeriodosDelMes(
  hoy: Date = new Date(),
  corte: number = 10
): { mes: { inicio: Date; fin: Date }; quincena1: { inicio: Date; fin: Date }; quincena2: { inicio: Date; fin: Date } } {
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const ultimoDia = new Date(año, mes + 1, 0).getDate();

  return {
    mes: { inicio: new Date(año, mes, 1), fin: new Date(año, mes, ultimoDia) },
    quincena1: { inicio: new Date(año, mes, 1), fin: new Date(año, mes, corte) },
    quincena2: { inicio: new Date(año, mes, corte + 1), fin: new Date(año, mes, ultimoDia) },
  };
}

/** Fin del día (23:59:59.999) de una fecha, para incluir todo el último día de un rango. */
export function finDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

/**
 * Todas las ocurrencias, dentro del mes indicado, de un gasto/ahorro fijo que cae
 * en un día del mes (ej. "se cobra el día 15"). Un gasto quincenal ocurre dos veces:
 * una vez cerca de diaBase y otra ~15 días después (o antes), una por cada quincena.
 */
export function ocurrenciasDelMes(
  diaBase: number,
  frecuencia: string,
  cantidad: number,
  año: number,
  mes: number,
  corte: number = 10
): { cantidad: number; fecha: Date }[] {
  const ultimoDia = new Date(año, mes + 1, 0).getDate();
  const fechaEnDia = (dia: number) => new Date(año, mes, Math.min(Math.max(dia, 1), ultimoDia));

  if (frecuencia === 'quincenal') {
    const diaOtraQuincena = diaBase <= corte ? diaBase + 15 : diaBase - 15;
    return [
      { cantidad, fecha: fechaEnDia(diaBase) },
      { cantidad, fecha: fechaEnDia(diaOtraQuincena) },
    ];
  }

  return [{ cantidad, fecha: fechaEnDia(diaBase) }];
}

/**
 * Suma las ocurrencias de gastos/ahorros fijos que caen dentro de un rango de fechas,
 * separando lo que ya pasó (pagado) de lo que todavía no llega (pendiente). "Ya pasó"
 * incluye el día de hoy.
 */
export function calcularPagadoPendiente(
  items: { dia: number; frecuencia?: string; cantidad: number }[],
  rango: { inicio: Date; fin: Date },
  hoy: Date = new Date(),
  corte: number = 10
): { pagado: number; pendiente: number } {
  const año = rango.inicio.getFullYear();
  const mes = rango.inicio.getMonth();
  const finRango = finDelDia(rango.fin);
  const hoyFinDelDia = finDelDia(hoy);

  let pagado = 0;
  let pendiente = 0;

  for (const item of items) {
    const ocurrencias = ocurrenciasDelMes(item.dia, item.frecuencia ?? 'mensual', item.cantidad, año, mes, corte);
    for (const oc of ocurrencias) {
      if (oc.fecha >= rango.inicio && oc.fecha <= finRango) {
        if (oc.fecha <= hoyFinDelDia) pagado += oc.cantidad;
        else pendiente += oc.cantidad;
      }
    }
  }

  return { pagado, pendiente };
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
