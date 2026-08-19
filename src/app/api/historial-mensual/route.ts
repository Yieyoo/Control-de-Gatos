// src/app/api/historial-mensual/route.ts
import { prisma } from '@/lib/prisma';
import {
  hoyMexico,
  rangoMes,
  fechaEnRangos,
  ocurrenciasDeGastoEnRangos,
} from '@/utils/calculos';
import { gastoNeto } from '@/utils/finanzas';
import type { IMesResumen, IHistorialMensualResumen } from '@/types';

const CORTE_1 = 10;
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hoy = hoyMexico();
    const añoSolicitado = parseInt(searchParams.get('año') ?? '', 10);
    const año = Number.isInteger(añoSolicitado) ? añoSolicitado : hoy.getUTCFullYear();

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

    const añoActual = hoy.getUTCFullYear();
    const mesActual = hoy.getUTCMonth();

    // Antes de esta fecha no hay datos reales que valga la pena comparar -- los
    // ingresos/gastos fijos son reglas recurrentes que, si se proyectaran hacia
    // atrás, inventarían meses con montos que en realidad nunca se registraron
    // (p. ej. si el usuario acaba de dar de alta su ingreso, no existió "antes").
    // Se usa la fecha de inicio más antigua entre los ingresos activos como
    // frontera; si no hay ninguno, no se filtra nada.
    const inicioReal = ingresos.length > 0
      ? new Date(Math.min(...ingresos.map((i) => new Date(i.fechaInicio).getTime())))
      : null;

    const añosDisponibles: number[] = [];
    const primerAño = inicioReal ? inicioReal.getUTCFullYear() : añoActual;
    for (let a = añoActual; a >= primerAño; a--) añosDisponibles.push(a);

    const meses: IMesResumen[] = [];

    const mesFinal = año === añoActual ? mesActual : 11;
    for (let mes = mesFinal; mes >= 0; mes--) {
      const rango = rangoMes(año, mes);
      if (inicioReal && rango.fin < inicioReal) continue;

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

      const gastosTotalMes = gastosFijosMes + gastosDomMes + gastosVariablesMes + comprasTarjetaMes;
      const ahorroMes = depositosMes - retirosMes;

      meses.push({
        año,
        mes,
        etiqueta: `${MESES[mes]} ${año}`,
        actual: año === añoActual && mes === mesActual,
        ingresos: ingresosMes,
        gastos: gastosTotalMes,
        ahorro: ahorroMes,
        balance: ingresosMes - gastosTotalMes - ahorroMes,
      });
    }

    const totales = meses.reduce(
      (acc, m) => ({
        ingresos: acc.ingresos + m.ingresos,
        gastos: acc.gastos + m.gastos,
        ahorro: acc.ahorro + m.ahorro,
        balance: acc.balance + m.balance,
      }),
      { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 }
    );

    const resumen: IHistorialMensualResumen = { año, añosDisponibles, meses, totales };

    return Response.json(resumen);
  } catch (error) {
    console.error('Error en historial mensual:', error);
    return Response.json({ error: 'Error al calcular el historial mensual' }, { status: 500 });
  }
}
