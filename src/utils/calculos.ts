// src/utils/calculos.ts
//
// IMPORTANTE: todas las fechas "de calendario" (día de cobro, día de la semana,
// rangos de quincena, etc.) se construyen y se leen en UTC (Date.UTC / getUTC*),
// nunca con el reloj local del proceso. Si usáramos new Date(año, mes, dia) normal,
// el resultado dependería de en qué zona horaria corre el servidor -- en Vercel es
// UTC, en una máquina local puede ser otra -- y esa media noche UTC se ve como el
// día anterior en la tarde/noche para alguien en México (UTC-6). Trabajar siempre
// en UTC evita ese corrimiento de "un día antes".

const OFFSET_MEXICO_HORAS = 6; // México (CST), sin horario de verano desde 2022

/** "Hoy" según el calendario de México, sin importar la hora del servidor. */
export function hoyMexico(): Date {
  const ahora = new Date();
  const ajustado = new Date(ahora.getTime() - OFFSET_MEXICO_HORAS * 60 * 60 * 1000);
  return fechaUTC(ajustado.getUTCFullYear(), ajustado.getUTCMonth(), ajustado.getUTCDate());
}

/** Construye una fecha en UTC a partir de año/mes/día (mes es 0-indexado, como Date normal). */
export function fechaUTC(año: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(año, mes, dia));
}

/** Día del mes (1-31) que marcaba el calendario en México en el momento de esa fecha/hora. */
export function diaMexico(fecha: Date): number {
  const ajustado = new Date(fecha.getTime() - OFFSET_MEXICO_HORAS * 60 * 60 * 1000);
  return ajustado.getUTCDate();
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
export function calcularProximaFechaMensual(diaDelMes: number, hoy: Date = hoyMexico()): Date {
  const intentar = (año: number, mes: number) => {
    const ultimoDiaDelMes = fechaUTC(año, mes + 1, 0).getUTCDate();
    return fechaUTC(año, mes, Math.min(diaDelMes, ultimoDiaDelMes));
  };

  const esteMes = intentar(hoy.getUTCFullYear(), hoy.getUTCMonth());
  if (esteMes >= fechaUTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())) {
    return esteMes;
  }
  return intentar(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1);
}

/**
 * Calcula la próxima fecha de un movimiento recurrente que se define por una
 * fecha de inicio + frecuencia (ej. ahorros domiciliados), avanzando desde el
 * inicio hasta encontrar la primera ocurrencia igual o posterior a hoy.
 */
export function calcularProximaFechaDesdeInicio(
  fechaInicio: Date,
  frecuencia: string,
  hoy: Date = hoyMexico()
): Date {
  const diasPorFrecuencia: Record<string, number> = {
    semanal: 7,
    quincenal: 15,
    mensual: 30,
  };
  const pasoDias = diasPorFrecuencia[frecuencia] ?? 30;

  let proxima = fechaUTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate());
  const hoyInicioDelDia = fechaUTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());

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
export function calcularProximaFechaSemanal(diasSemana: number[], hoy: Date = hoyMexico()): Date {
  const cursor = fechaUTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  if (diasSemana.length === 0) return cursor;
  for (let i = 0; i < 14; i++) {
    if (diasSemana.includes(cursor.getUTCDay())) return new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

export interface RangoFechas {
  inicio: Date;
  fin: Date;
}

/** Rango completo (día 1 al último día) de un mes de calendario cualquiera. */
export function rangoMes(año: number, mes: number): RangoFechas {
  const ultimoDia = fechaUTC(año, mes + 1, 0).getUTCDate();
  return { inicio: fechaUTC(año, mes, 1), fin: fechaUTC(año, mes, ultimoDia) };
}

/** Rango del mes de calendario que contiene `hoy` (día 1 al último día). */
export function rangoMesActual(hoy: Date = hoyMexico()): RangoFechas {
  return rangoMes(hoy.getUTCFullYear(), hoy.getUTCMonth());
}

/**
 * La quincena (según los días de pago del usuario, ej. 10 y 25) que contiene la
 * fecha dada: primera quincena = [corte1, corte2 - 1] (ej. 10-24), segunda
 * quincena = [corte2, corte1 - 1 del mes siguiente] (ej. 25 - 9 del mes
 * siguiente) -- esta última cruza de un mes a otro. Los cortes (10 y 25) son
 * los días de pago; cada quincena termina justo un día antes de que empiece
 * la siguiente, sin traslape.
 */
export function periodoQuincenaActual(
  hoy: Date = hoyMexico(),
  corte1: number = 10,
  corte2: number = 25
): RangoFechas {
  const dia = hoy.getUTCDate();
  const año = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth();

  if (dia >= corte1 && dia < corte2) {
    return { inicio: fechaUTC(año, mes, corte1), fin: fechaUTC(año, mes, corte2 - 1) };
  }
  if (dia >= corte2) {
    const mesSig = mes === 11 ? 0 : mes + 1;
    const añoSig = mes === 11 ? año + 1 : año;
    return { inicio: fechaUTC(año, mes, corte2), fin: fechaUTC(añoSig, mesSig, corte1 - 1) };
  }
  const mesAnt = mes === 0 ? 11 : mes - 1;
  const añoAnt = mes === 0 ? año - 1 : año;
  return { inicio: fechaUTC(añoAnt, mesAnt, corte2), fin: fechaUTC(año, mes, corte1 - 1) };
}

/** La quincena inmediatamente después de la que se le pasa. */
export function periodoQuincenaSiguiente(
  actual: RangoFechas,
  corte1: number = 10,
  corte2: number = 25
): RangoFechas {
  const diaSiguiente = new Date(actual.fin.getTime() + 24 * 60 * 60 * 1000);
  return periodoQuincenaActual(diaSiguiente, corte1, corte2);
}

/**
 * Ciclo de tarjeta de crédito (entre dos cortes) que contiene la fecha dada.
 * Ej. si el corte es el día 11 y hoy es 14 de agosto, el ciclo es del 12 de
 * agosto al 11 de septiembre (el que se está acumulando, todavía no cierra).
 */
export function cicloTarjetaActual(hoy: Date = hoyMexico(), diaCorte: number): RangoFechas {
  const dia = hoy.getUTCDate();
  const año = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth();

  if (dia <= diaCorte) {
    const mesAnt = mes === 0 ? 11 : mes - 1;
    const añoAnt = mes === 0 ? año - 1 : año;
    return { inicio: fechaUTC(añoAnt, mesAnt, diaCorte + 1), fin: fechaUTC(año, mes, diaCorte) };
  }
  const mesSig = mes === 11 ? 0 : mes + 1;
  const añoSig = mes === 11 ? año + 1 : año;
  return { inicio: fechaUTC(año, mes, diaCorte + 1), fin: fechaUTC(añoSig, mesSig, diaCorte) };
}

/** El ciclo justo antes del que se le pasa (mismo día de corte, un mes atrás) -- el estado de cuenta ya cerrado. */
export function cicloTarjetaAnterior(actual: RangoFechas, diaCorte: number): RangoFechas {
  const diaAntesDeInicio = new Date(actual.inicio.getTime() - 24 * 60 * 60 * 1000);
  return cicloTarjetaActual(diaAntesDeInicio, diaCorte);
}

/** Los pares {año, mes} de calendario que toca una lista de rangos (nunca son más de 2 por rango). */
export function mesesTocados(rangos: RangoFechas[]): { año: number; mes: number }[] {
  const vistos = new Set<string>();
  const resultado: { año: number; mes: number }[] = [];
  for (const r of rangos) {
    for (const d of [r.inicio, r.fin]) {
      const clave = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (!vistos.has(clave)) {
        vistos.add(clave);
        resultado.push({ año: d.getUTCFullYear(), mes: d.getUTCMonth() });
      }
    }
  }
  return resultado;
}

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Formatea una fecha como "10 ago", en UTC (no depende de la hora del servidor/navegador). */
export function formatearDiaMes(fecha: Date): string {
  return `${fecha.getUTCDate()} ${MESES_ABREV[fecha.getUTCMonth()]}`;
}

/** Fin del día (23:59:59.999 UTC) de una fecha, para incluir todo el último día de un rango. */
export function finDelDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), 23, 59, 59, 999));
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
  const ultimoDia = fechaUTC(año, mes + 1, 0).getUTCDate();
  const fechaEnDia = (dia: number) => fechaUTC(año, mes, Math.min(Math.max(dia, 1), ultimoDia));

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
    const cursor = fechaUTC(rango.inicio.getUTCFullYear(), rango.inicio.getUTCMonth(), rango.inicio.getUTCDate());
    const fin = finDelDia(rango.fin);
    while (cursor <= fin) {
      if (diasSemana.includes(cursor.getUTCDay())) {
        ocurrencias.push({ cantidad, fecha: new Date(cursor) });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return ocurrencias;
}

/**
 * Todas las ocurrencias de un gasto/ahorro fijo (mensual, quincenal o semanal)
 * dentro de una lista de rangos de fechas. Junta ocurrenciasDelMes/ocurrenciasSemanales
 * para no repetir esa lógica en cada lugar que necesita "¿cuándo cae esto en este rango?".
 */
export function ocurrenciasDeGastoEnRangos(
  gasto: { fechaCobro?: number | null; frecuencia: string; diasSemana?: string | null; cantidad: number },
  rangos: RangoFechas[],
  corte: number = 10
): { cantidad: number; fecha: Date }[] {
  if (gasto.frecuencia === 'semanal') {
    return ocurrenciasSemanales(parseDiasSemana(gasto.diasSemana), gasto.cantidad, rangos);
  }
  if (gasto.fechaCobro == null) return [];

  const resultado: { cantidad: number; fecha: Date }[] = [];
  for (const { año, mes } of mesesTocados(rangos)) {
    ocurrenciasDelMes(gasto.fechaCobro, gasto.frecuencia, gasto.cantidad, año, mes, corte).forEach((oc) => {
      if (fechaEnRangos(oc.fecha, rangos)) resultado.push(oc);
    });
  }
  return resultado;
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
