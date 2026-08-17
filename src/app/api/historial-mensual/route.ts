// src/app/api/historial-mensual/route.ts
import { prisma } from '@/lib/prisma';
import {
  hoyMexico,
  rangoMes,
  fechaEnRangos,
  ocurrenciasDeGastoEnRangos,
} from '@/utils/calculos';
import { gastoNeto } from '@/utils/finanzas';
import type { IMesResumen } from '@/types';

const CORTE_1 = 10;
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export async function GET() {
  try {
    const [ingresos, gastosFijos, gastosDomiciliados, gastosVariables, comprasTarjeta, movimientosAhorro] =
      await Promise.all([
        prisma.ingreso.findMany({ where: { activo: true } }),
        prisma.gastoFijo.findMany({ where: { activo: true } }),
        // Solo los domiciliados de tarjeta se proyectan aquí -- los de efectivo ya
        // están materializados como GastoVariable real y se leen de ahí, para no
        // contarlos dos veces.
        prisma.gastoDomiciliado.findMany({ where: { activo: true, tarjetaId: { not: null } } }),
        prisma.gastoVariable.findMany({ include: { devoluciones: true } }),
        prisma.compraTarjeta.findMany({ include: { devoluciones: true } }),
        prisma.movimientoAhorro.findMany(),
      ]);

    const hoy = hoyMexico();
    const añoActual = hoy.getUTCFullYear();
    const mesActual = hoy.getUTCMonth();

    const meses: IMesResumen[] = [];

    // De enero del año en curso hasta el mes actual, más reciente primero.
    for (let mes = mesActual; mes >= 0; mes--) {
      const rango = rangoMes(añoActual, mes);

      const ingresosMes = ingresos.reduce((sum, ing) => {
        if (ing.frecuencia === 'quincenal') return sum + ing.cantidad * 2;
        if (ing.frecuencia === 'mensual') return sum + ing.cantidad;
        if (ing.frecuencia === 'unico') {
          return fechaEnRangos(new Date(ing.fechaInicio), [rango]) ? sum + ing.cantidad : sum;
        }
        return sum;
      }, 0);

      const gastosFijosMes = gastosFijos.reduce(
        (sum, g) =>
          sum +
          ocurrenciasDeGastoEnRangos(
            { fechaCobro: g.fechaPago, frecuencia: 'mensual', cantidad: g.cantidad },
            [rango],
            CORTE_1
          ).reduce((s, oc) => s + oc.cantidad, 0),
        0
      );
      const gastosDomMes = gastosDomiciliados.reduce(
        (sum, g) =>
          sum + ocurrenciasDeGastoEnRangos(g, [rango], CORTE_1).reduce((s, oc) => s + oc.cantidad, 0),
        0
      );
      const gastosVariablesMes = gastosVariables
        .filter((g) => g.fuente !== 'tercero' && fechaEnRangos(new Date(g.fecha), [rango]))
        .reduce((s, g) => s + gastoNeto(g.cantidad, g.devoluciones), 0);
      const comprasTarjetaMes = comprasTarjeta
        .filter((c) => fechaEnRangos(new Date(c.fecha), [rango]))
        .reduce((s, c) => s + gastoNeto(c.cantidad, c.devoluciones), 0);

      // Depósitos/retiros reales de ahorro del mes (incluye los domiciliados ya
      // materializados) -- ver src/lib/finanzas.ts. Los retiros usados para pagar
      // algo directamente (origen "pago_gasto"/"pago_tarjeta") también cuentan:
      // el saldo de ahorro sí baja, aunque no sea una "transferencia" manual.
      const depositosMes = movimientosAhorro
        .filter((m) => m.tipo === 'deposito' && fechaEnRangos(new Date(m.fecha), [rango]))
        .reduce((s, m) => s + m.cantidad, 0);
      const retirosMes = movimientosAhorro
        .filter((m) => m.tipo === 'retiro' && fechaEnRangos(new Date(m.fecha), [rango]))
        .reduce((s, m) => s + m.cantidad, 0);

      meses.push({
        año: añoActual,
        mes,
        etiqueta: `${MESES[mes]} ${añoActual}`,
        ingresos: ingresosMes,
        gastos: gastosFijosMes + gastosDomMes + gastosVariablesMes + comprasTarjetaMes,
        ahorro: depositosMes - retirosMes,
      });
    }

    return Response.json(meses);
  } catch (error) {
    console.error('Error en historial mensual:', error);
    return Response.json({ error: 'Error al calcular el historial mensual' }, { status: 500 });
  }
}
