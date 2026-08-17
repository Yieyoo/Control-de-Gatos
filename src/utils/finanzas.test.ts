// src/utils/finanzas.test.ts
import { describe, expect, it } from 'vitest';
import {
  sumarDineroDisponible,
  efectoGastoVariable,
  efectoPagoTarjeta,
  efectoMovimientoAhorro,
  efectoCargoTarjetaDomiciliado,
  gastoNeto,
  calcularDeudaTarjeta,
  calcularMontoMensualMSI,
  calcularEstadoDeposito,
} from './finanzas';

describe('1. Pago normal desde cuenta', () => {
  it('un gasto pagado con dinero disponible resta del disponible del periodo', () => {
    const ingresoQuincena = 11951.8;
    const pago = { cantidad: 500, efecto: efectoGastoVariable('disponible') };
    expect(sumarDineroDisponible(ingresoQuincena, [pago])).toBeCloseTo(11451.8, 5);
  });
});

describe('2. Compra con tarjeta', () => {
  it('una compra de tarjeta no resta disponible pero sí aumenta la deuda', () => {
    const disponibleAntes = 5000;
    // Una CompraTarjeta nunca entra a la lista de movimientos de disponible -- no hay
    // "efecto" que calcular para ella, es justamente el punto: no toca disponible.
    expect(sumarDineroDisponible(disponibleAntes, [])).toBe(disponibleAntes);
    expect(calcularDeudaTarjeta(0, 0, 0) + 1000).toBe(1000);
  });
});

describe('3. Pago de tarjeta', () => {
  it('pagar la tarjeta con dinero disponible resta disponible y reduce la deuda, sin volver a contarse como gasto', () => {
    const disponibleAntes = 10000;
    const pagoTarjeta = { cantidad: 1000, efecto: efectoPagoTarjeta('disponible') };
    expect(sumarDineroDisponible(disponibleAntes, [pagoTarjeta])).toBe(9000);

    const comprado = 1000;
    const pagado = 1000;
    expect(calcularDeudaTarjeta(comprado, pagado, 0)).toBe(0);
  });

  it('pagar la tarjeta con ahorro o dinero de terceros NO resta el disponible', () => {
    const disponibleAntes = 10000;
    const pagoDesdeAhorro = { cantidad: 1000, efecto: efectoPagoTarjeta('ahorro') };
    const pagoDesdeTercero = { cantidad: 1000, efecto: efectoPagoTarjeta('tercero') };
    expect(sumarDineroDisponible(disponibleAntes, [pagoDesdeAhorro])).toBe(disponibleAntes);
    expect(sumarDineroDisponible(disponibleAntes, [pagoDesdeTercero])).toBe(disponibleAntes);
  });
});

describe('4. Pago parcial de tarjeta', () => {
  it('deuda 5000, pago 2000 -> deuda 3000, disponible -2000', () => {
    const deudaAnterior = calcularDeudaTarjeta(5000, 0, 0);
    const pago = 2000;
    const nuevaDeuda = calcularDeudaTarjeta(5000, pago, 0);
    expect(deudaAnterior).toBe(5000);
    expect(nuevaDeuda).toBe(3000);

    const disponibleAntes = 8000;
    const movimiento = { cantidad: pago, efecto: efectoPagoTarjeta('disponible') };
    expect(sumarDineroDisponible(disponibleAntes, [movimiento])).toBe(6000);
  });
});

describe('5. Compra a meses sin intereses (MSI)', () => {
  it('compra de $12,000 a 12 MSI: deuda completa de inmediato, $1,000/mes', () => {
    const cantidad = 12000;
    const numeroMeses = 12;
    expect(calcularMontoMensualMSI(cantidad, numeroMeses)).toBe(1000);
    // La compra entera ya es deuda, igual que una compra de contado.
    expect(calcularDeudaTarjeta(cantidad, 0, 0)).toBe(12000);
  });

  it('pagar una mensualidad de MSI se comporta igual que cualquier pago de tarjeta (sin gasto adicional)', () => {
    const deudaTrasCompra = calcularDeudaTarjeta(12000, 0, 0);
    const mensualidad = 1000;
    const deudaTrasPago = calcularDeudaTarjeta(12000, mensualidad, 0);
    expect(deudaTrasCompra - deudaTrasPago).toBe(mensualidad);

    const disponibleAntes = 20000;
    const pago = { cantidad: mensualidad, efecto: efectoPagoTarjeta('disponible') };
    expect(sumarDineroDisponible(disponibleAntes, [pago])).toBe(19000);
  });
});

describe('6. Transferencia a ahorro', () => {
  it('transferir $1,000 de disponible a ahorro resta disponible y no es gasto', () => {
    const disponibleAntes = 5000;
    const transferencia = { cantidad: 1000, efecto: efectoMovimientoAhorro('deposito', 'manual') };
    expect(sumarDineroDisponible(disponibleAntes, [transferencia])).toBe(4000);
  });

  it('un depósito materializado de un ahorro domiciliado no se cuenta aquí (ya se cuenta en el forecast de ahorro del periodo)', () => {
    expect(efectoMovimientoAhorro('deposito', 'domiciliado')).toBe('ninguno');
  });
});

describe('7. Retiro desde ahorro', () => {
  it('retirar $2,000 de ahorro hacia disponible suma al disponible', () => {
    const disponibleAntes = 3000;
    const retiro = { cantidad: 2000, efecto: efectoMovimientoAhorro('retiro', 'manual') };
    expect(sumarDineroDisponible(disponibleAntes, [retiro])).toBe(5000);
  });

  it('un retiro para pagar algo directamente desde ahorro no toca el disponible', () => {
    expect(efectoMovimientoAhorro('retiro', 'pago_gasto')).toBe('ninguno');
    expect(efectoMovimientoAhorro('retiro', 'pago_tarjeta')).toBe('ninguno');
  });
});

describe('8. Depósito de terceros', () => {
  it('un depósito de $2,000 sin usar queda pendiente y no afecta el disponible propio', () => {
    const estado = calcularEstadoDeposito(2000, 0);
    expect(estado).toEqual({ montoUtilizado: 0, pendiente: 2000, estado: 'pendiente' });
  });
});

describe('9. Pago realizado con dinero de terceros', () => {
  it('pagar $2,000 con un depósito de terceros de $2,000 lo deja utilizado y no resta disponible propio', () => {
    const disponibleAntes = 5000;
    const gastoConDineroDeTercero = { cantidad: 2000, efecto: efectoGastoVariable('tercero') };
    expect(sumarDineroDisponible(disponibleAntes, [gastoConDineroDeTercero])).toBe(disponibleAntes);

    const estado = calcularEstadoDeposito(2000, 2000);
    expect(estado.pendiente).toBe(0);
    expect(estado.estado).toBe('utilizado');
  });
});

describe('10. Pago parcial con dinero de terceros', () => {
  it('depósito de $3,000, se usan $2,000 -> pendiente $1,000, estado parcial', () => {
    const estado = calcularEstadoDeposito(3000, 2000);
    expect(estado).toEqual({ montoUtilizado: 2000, pendiente: 1000, estado: 'parcial' });
  });
});

describe('11. Devolución', () => {
  it('gasto de $1,000 con devolución de $300 -> gasto neto $700', () => {
    expect(gastoNeto(1000, [{ cantidad: 300 }])).toBe(700);
  });

  it('una devolución no se trata como ingreso: no aparece como movimiento "suma" en el disponible', () => {
    // La devolución neteó el gasto original (arriba); no se modela como un
    // movimiento aparte de tipo "suma" -- por eso no hay efectoDevolucion().
    const disponibleAntes = 1000;
    const gasto = { cantidad: gastoNeto(1000, [{ cantidad: 300 }]), efecto: efectoGastoVariable('disponible') };
    expect(sumarDineroDisponible(disponibleAntes, [gasto])).toBe(300);
  });
});

describe('12. Transferencia entre cuentas propias', () => {
  it('mover saldo entre dos lugares de ahorro no es gasto ni ingreso (no pasa por disponible)', () => {
    const disponibleAntes = 4000;
    // Una transferencia AhorroLugar -> AhorroLugar no genera ningún movimiento
    // de disponible: ni entra ni sale de tu dinero disponible.
    expect(sumarDineroDisponible(disponibleAntes, [])).toBe(disponibleAntes);
  });
});

describe('Cargos domiciliados de tarjeta (checkbox manual)', () => {
  it('mientras esté pendiente no resta disponible', () => {
    const disponibleAntes = 6000;
    const cargo = { cantidad: 300, efecto: efectoCargoTarjetaDomiciliado(false) };
    expect(sumarDineroDisponible(disponibleAntes, [cargo])).toBe(disponibleAntes);
  });

  it('al marcarlo como pagado, resta disponible', () => {
    const disponibleAntes = 6000;
    const cargo = { cantidad: 300, efecto: efectoCargoTarjetaDomiciliado(true) };
    expect(sumarDineroDisponible(disponibleAntes, [cargo])).toBe(5700);
  });
});
