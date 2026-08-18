// src/utils/finanzas.ts
//
// Reglas puras de contabilidad (sin Prisma, testeables con fixtures). El
// principio general: "Dinero disponible" es un valor 100% DERIVADO -- se
// recalcula sumando/restando los movimientos reales ya registrados cada vez
// que se pide, nunca se guarda ni se corrige a mano (ver calcularDineroDisponible).
// Un compromiso pendiente (gasto fijo sin confirmar, ahorro programado sin
// enviar, compra de tarjeta sin pagar) NUNCA resta disponible -- solo lo hace
// cuando se confirma/registra el movimiento real:
//   - GASTO: resta disponible solo si sale de tu dinero disponible; si sale
//     de ahorro o de un depósito de tercero, no resta disponible (pero un
//     gasto pagado con ahorro sí sigue contando como tu gasto real, mientras
//     que uno pagado con dinero de tercero no cuenta para nada tuyo).
//   - COMPRA de tarjeta: nunca resta disponible -- solo sube la deuda de esa
//     tarjeta (ver "Debes en total"). Es deuda que vas pagando después.
//   - PAGO de tarjeta: si sale de tu disponible, sí lo resta (es dinero real
//     que salió de tu cuenta); si sale de ahorro, resta esa cuenta de ahorro
//     en vez de disponible; si es de un tercero, no resta nada tuyo.
//   - TRANSFERENCIA a/desde ahorro (manual o un ahorro domiciliado ya
//     confirmado con el checkbox "ya lo envié") sí mueve disponible, pero no
//     es gasto ni ingreso.

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

/**
 * Un pago de tarjeta (abono a la deuda) resta disponible solo si salió de tu
 * dinero disponible en efectivo -- igual que un gasto normal. La compra en sí
 * nunca resta disponible (solo sube la deuda); es el pago real el que sí
 * representa dinero saliendo de tu cuenta.
 */
export function efectoPagoTarjeta(fuente: IFuenteDinero): EfectoDisponible {
  return fuente === 'disponible' ? 'resta' : 'ninguno';
}

/**
 * Un movimiento de ahorro mueve el disponible cuando es una transferencia
 * manual, o un ahorro domiciliado ya confirmado con el checkbox "ya lo
 * envié" (origen "domiciliado") -- en ambos casos depósito = sale de
 * disponible, retiro = regresa a disponible. Un retiro para pagar algo
 * directamente (origen "pago_gasto"/"pago_tarjeta") nunca pasa por
 * disponible -- el gasto/pago que lo generó es lo que se contabiliza.
 */
export function efectoMovimientoAhorro(
  tipo: 'deposito' | 'retiro',
  origen: 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta'
): EfectoDisponible {
  if (origen === 'pago_gasto' || origen === 'pago_tarjeta') return 'ninguno';
  return tipo === 'deposito' ? 'resta' : 'suma';
}

/**
 * Un cargo domiciliado ligado a una tarjeta (GastoDomiciliado.tarjetaId) es
 * una compra a crédito: nunca toca el dinero disponible, esté pendiente o
 * marcado como pagado con el checkbox -- es deuda de tarjeta, se lleva
 * completa aparte en "Debes en total" (ver efectoPagoTarjeta).
 */
export function efectoCargoTarjetaDomiciliado(_marcadoComoPagado: boolean): EfectoDisponible {
  return 'ninguno';
}

/**
 * Dinero disponible: se calcula de cero cada vez, sumando el ingreso ya
 * acreditado a la fecha y aplicando el efecto de cada movimiento real ya
 * registrado (gastos, pagos de tarjeta, movimientos de ahorro) -- nunca es
 * un contador que se ajusta a mano ni que se pueda desincronizar: siempre
 * es la suma exacta de lo que realmente ocurrió hasta hoy.
 */
export function calcularDineroDisponible(datos: {
  ingresoAcumulado: number;
  gastosVariables: { cantidad: number; fuente: IFuenteDinero; devoluciones: { cantidad: number }[] }[];
  pagosTarjeta: { cantidad: number; fuente: IFuenteDinero }[];
  movimientosAhorro: {
    cantidad: number;
    tipo: 'deposito' | 'retiro';
    origen: 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta';
  }[];
}): number {
  const movimientos: MovimientoCaja[] = [
    ...datos.gastosVariables.map((g) => ({
      cantidad: gastoNeto(g.cantidad, g.devoluciones),
      efecto: efectoGastoVariable(g.fuente),
    })),
    ...datos.pagosTarjeta.map((p) => ({
      cantidad: p.cantidad,
      efecto: efectoPagoTarjeta(p.fuente),
    })),
    ...datos.movimientosAhorro.map((m) => ({
      cantidad: m.cantidad,
      efecto: efectoMovimientoAhorro(m.tipo, m.origen),
    })),
  ];
  return sumarDineroDisponible(datos.ingresoAcumulado, movimientos);
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
