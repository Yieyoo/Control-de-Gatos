/** Conversión estricta de cantidades monetarias recibidas por API. */
export function leerMontoPositivo(valor: unknown): number | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const monto = Number(valor);
  return Number.isFinite(monto) && monto > 0 ? monto : null;
}

/** Conversión estricta para saldos iniciales: cero se permite, negativos no. */
export function leerSaldoNoNegativo(valor: unknown): number | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const monto = Number(valor);
  return Number.isFinite(monto) && monto >= 0 ? monto : null;
}

export function leerEnteroPositivo(valor: unknown): number | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

export function leerFecha(valor: unknown): Date | null {
  if (typeof valor !== 'string' && !(valor instanceof Date)) return null;
  if (typeof valor === 'string') {
    const calendario = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(valor);
    if (calendario) {
      const [, año, mes, dia] = calendario;
      const comprobacion = new Date(Date.UTC(Number(año), Number(mes) - 1, Number(dia)));
      if (comprobacion.getUTCFullYear() !== Number(año) || comprobacion.getUTCMonth() !== Number(mes) - 1 || comprobacion.getUTCDate() !== Number(dia)) {
        return null;
      }
    }
  }
  const fecha = new Date(valor instanceof Date ? valor.getTime() : valor);
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

export function validarDiasSemana(valor: unknown): valor is string {
  if (typeof valor !== 'string' || valor.trim() === '') return false;
  const partes = valor.split(',').map((parte) => parte.trim());
  const dias = partes.map(Number);
  return dias.length > 0 && dias.every((dia, i) => /^\d$/.test(partes[i]) && Number.isInteger(dia) && dia >= 0 && dia <= 6) &&
    new Set(dias).size === dias.length;
}
