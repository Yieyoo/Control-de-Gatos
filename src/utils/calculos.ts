// src/utils/calculos.ts

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
 * Convierte el string guardado en BD ("1,2,3,4,5") a una lista de números de
 * día de la semana (0 = domingo ... 6 = sábado).
 */
export function parseDiasSemana(diasSemana: string | null | undefined): number[] {
  if (!diasSemana) return [];
  return diasSemana
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6);
}

/**
 * Próxima fecha (hoy o después) cuyo día de la semana esté en diasSemana.
 */
export function calcularProximaFechaSemanal(diasSemana: number[], hoy: Date = new Date()): Date {
  const cursor = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (diasSemana.length === 0) return cursor;
  for (let i = 0; i < 14; i++) {
    if (diasSemana.includes(cursor.getDay())) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

export interface RangoFechas {
  inicio: Date;
  fin: Date;
}

/**
 * Rangos de fechas de cada período del mes actual, según los días de pago del
 * usuario (por defecto 10 y 25): quincena 1 = del corte1 al corte2 (ej. 10-25);
 * quincena 2 = el resto del mes, que queda en dos pedazos (1 al corte1-1, y
 * corte2+1 al último día) porque en un mes de calendario no es continua.
 * quincena1 ∪ quincena2 = mes completo, sin traslapes.
 */
export function obtenerPeriodosDelMes(
  hoy: Date = new Date(),
  corte1: number = 10,
  corte2: number = 25
): { mes: RangoFechas[]; quincena1: RangoFechas[]; quincena2: RangoFechas[] } {
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const ultimoDia = new Date(año, mes + 1, 0).getDate();
  const enDia = (dia: number) => new Date(año, mes, dia);

  const quincena2: RangoFechas[] = [];
  if (corte1 > 1) quincena2.push({ inicio: enDia(1), fin: enDia(corte1 - 1) });
  if (corte2 < ultimoDia) quincena2.push({ inicio: enDia(corte2 + 1), fin: enDia(ultimoDia) });

  return {
    mes: [{ inicio: enDia(1), fin: enDia(ultimoDia) }],
    quincena1: [{ inicio: enDia(corte1), fin: enDia(corte2) }],
    quincena2,
  };
}

/** Fin del día (23:59:59.999) de una fecha, para incluir todo el último día de un rango. */
export function finDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

/** Si una fecha cae dentro de alguno de una lista de rangos (inclusive). */
export function fechaEnRangos(fecha: Date, rangos: RangoFechas[]): boolean {
  return rangos.some((r) => fecha >= r.inicio && fecha <= finDelDia(r.fin));
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
 * Todas las ocurrencias de un gasto/ahorro semanal (ej. "cada martes", o
 * "de lunes a viernes") dentro de una lista de rangos de fechas.
 */
export function ocurrenciasSemanales(
  diasSemana: number[],
  cantidad: number,
  rangos: RangoFechas[]
): { cantidad: number; fecha: Date }[] {
  if (diasSemana.length === 0) return [];
  const ocurrencias: { cantidad: number; fecha: Date }[] = [];

  for (const rango of rangos) {
    const cursor = new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate());
    const fin = finDelDia(rango.fin);
    while (cursor <= fin) {
      if (diasSemana.includes(cursor.getDay())) {
        ocurrencias.push({ cantidad, fecha: new Date(cursor) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return ocurrencias;
}

/**
 * Suma las ocurrencias de gastos/ahorros fijos (mensuales o quincenales, con día
 * del mes) que caen dentro de una lista de rangos de fechas, separando lo que
 * ya pasó (pagado) de lo que todavía no llega (pendiente). "Ya pasó" incluye hoy.
 */
export function calcularPagadoPendiente(
  items: { dia: number; frecuencia?: string; cantidad: number }[],
  rangos: RangoFechas[],
  hoy: Date = new Date(),
  corte: number = 10
): { pagado: number; pendiente: number } {
  if (rangos.length === 0) return { pagado: 0, pendiente: 0 };
  const año = rangos[0].inicio.getFullYear();
  const mes = rangos[0].inicio.getMonth();
  const hoyFinDelDia = finDelDia(hoy);

  let pagado = 0;
  let pendiente = 0;

  for (const item of items) {
    const ocurrencias = ocurrenciasDelMes(item.dia, item.frecuencia ?? 'mensual', item.cantidad, año, mes, corte);
    for (const oc of ocurrencias) {
      if (fechaEnRangos(oc.fecha, rangos)) {
        if (oc.fecha <= hoyFinDelDia) pagado += oc.cantidad;
        else pendiente += oc.cantidad;
      }
    }
  }

  return { pagado, pendiente };
}

/**
 * Igual que calcularPagadoPendiente, pero para gastos/ahorros semanales
 * (definidos por una lista de días de la semana en vez de un día del mes).
 */
export function calcularPagadoPendienteSemanal(
  items: { diasSemana: number[]; cantidad: number }[],
  rangos: RangoFechas[],
  hoy: Date = new Date()
): { pagado: number; pendiente: number } {
  const hoyFinDelDia = finDelDia(hoy);
  let pagado = 0;
  let pendiente = 0;

  for (const item of items) {
    const ocurrencias = ocurrenciasSemanales(item.diasSemana, item.cantidad, rangos);
    for (const oc of ocurrencias) {
      if (oc.fecha <= hoyFinDelDia) pagado += oc.cantidad;
      else pendiente += oc.cantidad;
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
