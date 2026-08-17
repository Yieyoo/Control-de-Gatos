// src/utils/finanzas.ts
//
// Reglas puras de contabilidad (sin Prisma, testeables con fixtures). El
// principio general: GASTO resta disponible solo si sale de tu dinero
// disponible; si sale de ahorro o de un depósito de tercero, no resta
// disponible (pero un gasto pagado con ahorro sí sigue contando como tu
// gasto real, mientras que uno pagado con dinero de tercero no cuenta para
// nada tuyo). PAGO de tarjeta liquida una deuda ya contada como gasto -- no
// vuelve a contarse como gasto. TRANSFERENCIA entre disponible y ahorro sí
// mueve el número de disponible, pero no es gasto ni ingreso.

import type { IFuenteDinero } from '@/types';

export type EfectoDisponible = 'resta' | 'suma' | 'ninguno';

export interface MovimientoCaja {
  cantidad: number;
  efecto: EfectoDisponible;
}

/**
 * Reduce una lista de movimientos de caja (cada uno ya clasificado como
 * resta/suma/ninguno) sobre el ingreso del periodo para obtener el dinero
 * disponible. Es el único lugar donde se suma/resta -- todo lo demás en este
 * archivo solo decide, para cada tipo de movimiento, cuál de los tres
 * efectos le corresponde.
 */
export function sumarDineroDisponible(ingresos: number, movimientos: MovimientoCaja[]): number {
  return movimientos.reduce((total, m) => {
    if (m.efecto === 'resta') return total - m.cantidad;
    if (m.efecto === 'suma') return total + m.cantidad;
    return total;
  }, ingresos);
}

/** Un gasto (GastoVariable) solo resta disponible si salió de tu dinero disponible en efectivo. */
export function efectoGastoVariable(fuente: IFuenteDinero): EfectoDisponible {
  return fuente === 'disponible' ? 'resta' : 'ninguno';
}

/** Un pago de tarjeta solo resta disponible si se pagó con dinero disponible (no con ahorro ni con dinero de tercero). */
export function efectoPagoTarjeta(fuente: IFuenteDinero): EfectoDisponible {
  return fuente === 'disponible' ? 'resta' : 'ninguno';
}

/**
 * Un movimiento de ahorro solo mueve el disponible cuando es una
 * transferencia manual entre tu disponible y tu ahorro: depósito manual =
 * sale de disponible, retiro manual = regresa a disponible. Los
 * materializados de un ahorro domiciliado ya se cuentan aparte (vía el
 * forecast de "ahorro del periodo"), y un retiro para pagar algo
 * directamente (origen "pago_gasto"/"pago_tarjeta") nunca pasa por
 * disponible -- el gasto/pago que lo generó es lo que se contabiliza.
 */
export function efectoMovimientoAhorro(
  tipo: 'deposito' | 'retiro',
  origen: 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta'
): EfectoDisponible {
  if (origen !== 'manual') return 'ninguno';
  return tipo === 'deposito' ? 'resta' : 'suma';
}

/**
 * Un cargo domiciliado ligado a una tarjeta (GastoDomiciliado.tarjetaId) es
 * una compra a crédito: mientras esté pendiente, no toca disponible (solo
 * cuenta como deuda de tarjeta). Recién cuando el usuario lo marca como
 * pagado con el checkbox, se trata como si hubieras pagado ese cargo de tu
 * dinero disponible.
 */
export function efectoCargoTarjetaDomiciliado(marcadoComoPagado: boolean): EfectoDisponible {
  return marcadoComoPagado ? 'resta' : 'ninguno';
}

/**
 * Gasto neto de un gasto variable, restando cualquier devolución que se le
 * haya registrado. Las devoluciones se descuentan del periodo del gasto
 * original (no del periodo en que se recibe la devolución) para que
 * "cuánto gasté en X" sea siempre el neto, como pide el usuario
 * ("gasto neto $700"), sin necesitar reabrir periodos ya calculados.
 */
export function gastoNeto(cantidadOriginal: number, devoluciones: { cantidad: number }[]): number {
  const totalDevuelto = devoluciones.reduce((sum, d) => sum + d.cantidad, 0);
  return cantidadOriginal - totalDevuelto;
}

/** Deuda de una tarjeta: todo lo comprado (incluye MSI completo) menos lo pagado, más los cargos domiciliados pendientes. */
export function calcularDeudaTarjeta(comprado: number, pagado: number, cargosDomiciliadosPendientes: number): number {
  return comprado - pagado + cargosDomiciliadosPendientes;
}

/** Pago mensual de una compra a meses sin intereses. */
export function calcularMontoMensualMSI(cantidad: number, numeroMeses: number): number {
  return cantidad / numeroMeses;
}

export interface EstadoDeposito {
  montoUtilizado: number;
  pendiente: number;
  estado: 'pendiente' | 'parcial' | 'utilizado';
}

/**
 * Estado de un depósito de tercero, calculado (no guardado) a partir de la
 * suma de gastos/pagos vinculados a él -- mismo patrón que ya usa el
 * proyecto para la deuda de tarjeta (`debe` computado, no persistido).
 */
export function calcularEstadoDeposito(cantidad: number, montoUtilizado: number): EstadoDeposito {
  const pendiente = Math.max(0, cantidad - montoUtilizado);
  const estado: EstadoDeposito['estado'] = montoUtilizado <= 0 ? 'pendiente' : pendiente > 0 ? 'parcial' : 'utilizado';
  return { montoUtilizado, pendiente, estado };
}
