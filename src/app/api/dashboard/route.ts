// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import {
  calcularProximaFechaMensual,
  calcularProximaFechaDesdeInicio,
  calcularProximaFechaSemanal,
  rangoMesActual,
  periodoQuincenaActual,
  periodoQuincenaSiguiente,
  cicloTarjetaActual,
  ocurrenciasDeGastoEnRangos,
  calcularPorcentaje,
  mesesTocados,
  ocurrenciasDelMes,
  ocurrenciasSemanales,
  parseDiasSemana,
  finDelDia,
  fechaEnRangos,
  formatearDiaMes,
  hoyMexico,
  diaMexico,
  type RangoFechas,
} from '@/utils/calculos';
import type {
  IDashboardResumen,
  IGastoPorCategoria,
  IProximoMovimiento,
  IMovimientoPeriodo,
  IResumenPeriodo,
  IDeudaTarjeta,
  IAhorroLugar,
  IPorcentajeDestino,
} from '@/types';
import type { Ingreso, Prisma } from '@prisma/client';

type GastoFijoConCategoria = Prisma.GastoFijoGetPayload<{ include: { categoria: true } }>;
type GastoDomiciliadoConCategoria = Prisma.GastoDomiciliadoGetPayload<{ include: { categoria: true } }>;
type GastoVariableConCategoria = Prisma.GastoVariableGetPayload<{ include: { categoria: true } }>;
type AhorroDomiciliado = Prisma.AhorroDomiciliadoGetPayload<Record<string, never>>;

// Días de pago del usuario: quincenas de 10 a 25 y de 26 al 10 del mes siguiente
const CORTE_1 = 10;
const CORTE_2 = 25;

interface OcurrenciaTag {
  nombre: string;
  cantidad: number;
  fecha: Date;
  tipo: 'gasto' | 'ahorro';
  categoriaColor?: string;
  categoriaTipoPresupuesto?: string | null;
}

// Meta de "% destinado a": 50% necesidades, 20% gustos (del ingreso del periodo),
// y un monto fijo de ahorro por quincena (independiente del ingreso).
const META_NECESIDADES_PCT = 50;
const META_GUSTOS_PCT = 20;
const META_AHORRO_QUINCENAL = 3000;

function clasificarPresupuesto(tipo: string | null | undefined): 'necesidad' | 'gusto' {
  return tipo === 'necesidad' ? 'necesidad' : 'gusto';
}

function construirPeriodo(
  id: 'mes' | 'quincena1' | 'quincena2',
  etiqueta: string,
  rangoTexto: string,
  rangos: RangoFechas[],
  esQuincena: boolean,
  hoy: Date,
  ingresos: Ingreso[],
  gastosFijos: GastoFijoConCategoria[],
  gastosDomiciliados: GastoDomiciliadoConCategoria[],
  ahorrosDomiciliados: AhorroDomiciliado[],
  gastosVariables: GastoVariableConCategoria[]
): IResumenPeriodo {
  const hoyFinDelDia = finDelDia(hoy);

  // Ingreso no tiene un día fijo como los gastos domiciliados, así que se prorratea
  // según el tipo de periodo: una quincena ve una vez el monto quincenal (y la mitad
  // del mensual); el mes completo ve el doble del quincenal (dos quincenas) y el
  // mensual completo.
  const ingresosPeriodo = ingresos.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    if (ing.frecuencia === 'quincenal') return sum + (esQuincena ? ing.cantidad : ing.cantidad * 2);
    if (ing.frecuencia === 'mensual') return sum + (esQuincena ? ing.cantidad / 2 : ing.cantidad);
    if (ing.frecuencia === 'unico') {
      return fechaEnRangos(new Date(ing.fechaInicio), rangos) ? sum + ing.cantidad : sum;
    }
    return sum;
  }, 0);

  // Ocurrencias de gastos/ahorros fijos dentro de este periodo específico. Un
  // periodo puede tocar hasta 2 meses de calendario (ej. 26 ago - 10 sep), así
  // que generamos las ocurrencias mensuales/quincenales para cada mes tocado.
  const ocurrencias: OcurrenciaTag[] = [];
  const gastosFijosActivos = gastosFijos.filter((g) => g.activo);
  const gastosDomActivos = gastosDomiciliados.filter((g) => g.activo);
  const ahorrosDomActivos = ahorrosDomiciliados.filter((a) => a.activo);

  for (const { año, mes } of mesesTocados(rangos)) {
    gastosFijosActivos.forEach((g) => {
      ocurrenciasDelMes(g.fechaPago, 'mensual', g.cantidad, año, mes, CORTE_1).forEach((oc) => {
        if (fechaEnRangos(oc.fecha, rangos)) {
          ocurrencias.push({
            nombre: g.nombre,
            cantidad: oc.cantidad,
            fecha: oc.fecha,
            tipo: 'gasto',
            categoriaColor: g.categoria.color,
            categoriaTipoPresupuesto: g.categoria.tipoPresupuesto,
          });
        }
      });
    });

    gastosDomActivos
      .filter((g) => g.frecuencia !== 'semanal' && g.fechaCobro != null)
      .forEach((g) => {
        ocurrenciasDelMes(g.fechaCobro as number, g.frecuencia, g.cantidad, año, mes, CORTE_1).forEach((oc) => {
          if (fechaEnRangos(oc.fecha, rangos)) {
            ocurrencias.push({
              nombre: g.nombre,
              cantidad: oc.cantidad,
              fecha: oc.fecha,
              tipo: 'gasto',
              categoriaColor: g.categoria.color,
              categoriaTipoPresupuesto: g.categoria.tipoPresupuesto,
            });
          }
        });
      });

    ahorrosDomActivos
      .filter((a) => a.frecuencia !== 'semanal')
      .forEach((a) => {
        const dia = diaMexico(new Date(a.fechaInicio));
        ocurrenciasDelMes(dia, a.frecuencia, a.cantidad, año, mes, CORTE_1).forEach((oc) => {
          if (fechaEnRangos(oc.fecha, rangos)) {
            ocurrencias.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' });
          }
        });
      });
  }

  gastosDomActivos
    .filter((g) => g.frecuencia === 'semanal')
    .forEach((g) => {
      ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, rangos).forEach((oc) =>
        ocurrencias.push({
          nombre: g.nombre,
          cantidad: oc.cantidad,
          fecha: oc.fecha,
          tipo: 'gasto',
          categoriaColor: g.categoria.color,
          categoriaTipoPresupuesto: g.categoria.tipoPresupuesto,
        })
      );
    });

  ahorrosDomActivos
    .filter((a) => a.frecuencia === 'semanal')
    .forEach((a) => {
      ocurrenciasSemanales(parseDiasSemana(a.diasSemana), a.cantidad, rangos).forEach((oc) =>
        ocurrencias.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' })
      );
    });

  const gastosVariablesEnPeriodo = gastosVariables.filter((g) => fechaEnRangos(new Date(g.fecha), rangos));

  const sumar = (ocs: OcurrenciaTag[], pagado: boolean) =>
    ocs.filter((oc) => (oc.fecha <= hoyFinDelDia) === pagado).reduce((s, oc) => s + oc.cantidad, 0);

  const gastoOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'gasto');
  const ahorroOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'ahorro');

  const gastosFijosPagado = sumar(gastoOcurrencias, true);
  const gastosFijosPendiente = sumar(gastoOcurrencias, false);
  const ahorroDelMesPagado = sumar(ahorroOcurrencias, true);
  const ahorroDelMesPendiente = sumar(ahorroOcurrencias, false);
  const gastosVariablesPeriodo = gastosVariablesEnPeriodo.reduce((s, g) => s + g.cantidad, 0);

  const dineroDisponible = ingresosPeriodo - gastosFijosPagado - gastosVariablesPeriodo - ahorroDelMesPagado;
  // "Dinero real": el disponible de hoy, pero imaginando que también se liquidan
  // los pendientes de este periodo (gastos fijos y ahorros que aún no llegan). La
  // deuda de tarjeta no se resta aquí porque no necesariamente se paga en esta quincena.
  const dineroReal = dineroDisponible - gastosFijosPendiente - ahorroDelMesPendiente;

  // "% destinado a": cuánto de lo ya gastado/ahorrado este periodo fue a necesidades,
  // gustos o ahorro, comparado contra una meta (50% / 20% / monto fijo de ahorro).
  const gastosFijosPagados = gastoOcurrencias.filter((oc) => oc.fecha <= hoyFinDelDia);
  const sumarPorTipo = (tipo: 'necesidad' | 'gusto') =>
    gastosFijosPagados
      .filter((oc) => clasificarPresupuesto(oc.categoriaTipoPresupuesto) === tipo)
      .reduce((s, oc) => s + oc.cantidad, 0) +
    gastosVariablesEnPeriodo
      .filter((g) => clasificarPresupuesto(g.categoria.tipoPresupuesto) === tipo)
      .reduce((s, g) => s + g.cantidad, 0);

  const necesidadesMonto = sumarPorTipo('necesidad');
  const gustosMonto = sumarPorTipo('gusto');
  const ahorroMonto = ahorroDelMesPagado;

  const metaNecesidadesMonto = (ingresosPeriodo * META_NECESIDADES_PCT) / 100;
  const metaGustosMonto = (ingresosPeriodo * META_GUSTOS_PCT) / 100;
  const metaAhorroMonto = esQuincena ? META_AHORRO_QUINCENAL : META_AHORRO_QUINCENAL * 2;

  const porcentajeDestino: IPorcentajeDestino = {
    necesidades: {
      monto: necesidadesMonto,
      porcentaje: calcularPorcentaje(necesidadesMonto, ingresosPeriodo),
      metaMonto: metaNecesidadesMonto,
      metaPorcentaje: META_NECESIDADES_PCT,
    },
    gustos: {
      monto: gustosMonto,
      porcentaje: calcularPorcentaje(gustosMonto, ingresosPeriodo),
      metaMonto: metaGustosMonto,
      metaPorcentaje: META_GUSTOS_PCT,
    },
    ahorro: {
      monto: ahorroMonto,
      porcentaje: calcularPorcentaje(ahorroMonto, ingresosPeriodo),
      metaMonto: metaAhorroMonto,
      metaPorcentaje: calcularPorcentaje(metaAhorroMonto, ingresosPeriodo),
    },
  };

  const movimientos: IMovimientoPeriodo[] = [
    ...ocurrencias.map((oc) => ({
      nombre: oc.nombre,
      cantidad: oc.cantidad,
      fecha: oc.fecha.toISOString(),
      tipo: oc.tipo,
      pagado: oc.fecha <= hoyFinDelDia,
      categoriaColor: oc.categoriaColor,
    })),
    ...gastosVariablesEnPeriodo.map((g) => ({
      nombre: g.nombre,
      cantidad: g.cantidad,
      fecha: new Date(g.fecha).toISOString(),
      tipo: 'gasto' as const,
      pagado: true,
      categoriaColor: g.categoria.color,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    id,
    etiqueta,
    inicio: rangos[0].inicio.toISOString(),
    fin: rangos[rangos.length - 1].fin.toISOString(),
    rangoTexto,
    ingresos: ingresosPeriodo,
    gastosFijos: gastosFijosPagado,
    gastosFijosPendiente,
    gastosVariables: gastosVariablesPeriodo,
    ahorroDelMes: ahorroDelMesPagado,
    ahorroDelMesPendiente,
    dineroDisponible,
    dineroReal,
    porcentajeDestino,
    movimientos,
  };
}

export async function GET() {
  try {
    const [ingresos, ahorrosLugares, gastosDomiciliados, ahorrosDomiciliados, gastosFijos, gastosVariables, tarjetas, comprasTarjeta, pagosTarjeta] =
      await Promise.all([
        prisma.ingreso.findMany({ where: { activo: true } }),
        prisma.ahorroLugar.findMany(),
        prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
        prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
        prisma.gastoVariable.findMany({ include: { categoria: true } }),
        prisma.tarjetaCredito.findMany({ where: { activa: true } }),
        prisma.compraTarjeta.findMany(),
        prisma.pagoTarjeta.findMany(),
      ]);

    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);

    const hoy = hoyMexico();
    const rangoMes = rangoMesActual(hoy);
    const periodoActual = periodoQuincenaActual(hoy, CORTE_1, CORTE_2);
    const periodoProximo = periodoQuincenaSiguiente(periodoActual, CORTE_1, CORTE_2);

    // Deuda de tarjetas: todo lo que llevas comprado (haya cortado o no), más los gastos
    // domiciliados ligados a esta tarjeta que ya cayeron en el periodo actual y no se
    // marcaron como pagados por adelantado, menos lo que ya abonaste.
    const deudaTarjetas: IDeudaTarjeta[] = tarjetas.map((t) => {
      const comprado = comprasTarjeta
        .filter((c) => c.tarjetaId === t.id)
        .reduce((sum, c) => sum + c.cantidad, 0);
      const pagado = pagosTarjeta
        .filter((p) => p.tarjetaId === t.id)
        .reduce((sum, p) => sum + p.cantidad, 0);

      const cicloActualTarjeta = cicloTarjetaActual(hoy, t.diaCorte);
      const cargosDomiciliados = gastosDomiciliados
        .filter((g) => g.activo && g.tarjetaId === t.id)
        .reduce((sum, g) => {
          const ocurrencias = ocurrenciasDeGastoEnRangos(g, [cicloActualTarjeta], CORTE_1);
          const pendientes = ocurrencias.filter(
            (oc) => !g.pagadoAdelantadoHasta || g.pagadoAdelantadoHasta < oc.fecha
          );
          return sum + pendientes.reduce((s, oc) => s + oc.cantidad, 0);
        }, 0);

      const debe = comprado - pagado + cargosDomiciliados;
      return {
        id: t.id,
        nombre: t.nombre,
        debe,
        pagoQuincenal: t.pagoQuincenal ?? undefined,
        diaCorte: t.diaCorte,
      };
    });
    const deudaTarjetasTotal = deudaTarjetas.reduce((sum, t) => sum + t.debe, 0);

    const args = [ingresos, gastosFijos, gastosDomiciliados, ahorrosDomiciliados, gastosVariables] as const;

    const mes = construirPeriodo('mes', 'Este mes', formatearRango(rangoMes), [rangoMes], false, hoy, ...args);
    const quincena1 = construirPeriodo(
      'quincena1',
      'la quincena actual',
      formatearRango(periodoActual),
      [periodoActual],
      true,
      hoy,
      ...args
    );
    const quincena2 = construirPeriodo(
      'quincena2',
      'la próxima quincena',
      formatearRango(periodoProximo),
      [periodoProximo],
      true,
      hoy,
      ...args
    );

    // Gastos por categoría del mes (fijos + domiciliados en su equivalente mensual + variables de este mes)
    const montosPorCategoria = new Map<number, { nombre: string; color: string; monto: number }>();
    const acumular = (
      categoriaId: number | null | undefined,
      categoria: { nombre: string; color: string } | null | undefined,
      monto: number
    ) => {
      if (!categoriaId || !categoria) return;
      const actual = montosPorCategoria.get(categoriaId);
      if (actual) {
        actual.monto += monto;
      } else {
        montosPorCategoria.set(categoriaId, { nombre: categoria.nombre, color: categoria.color, monto });
      }
    };

    gastosFijos.forEach((g) => acumular(g.categoriaId, g.categoria, g.cantidad));
    gastosDomiciliados.forEach((g) => {
      if (g.frecuencia === 'semanal') {
        const ocurrencias = ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, [rangoMes]);
        acumular(g.categoriaId, g.categoria, ocurrencias.reduce((sum, oc) => sum + oc.cantidad, 0));
      } else {
        acumular(g.categoriaId, g.categoria, g.frecuencia === 'quincenal' ? g.cantidad * 2 : g.cantidad);
      }
    });
    gastosVariables.forEach((g) => {
      if (fechaEnRangos(new Date(g.fecha), [rangoMes])) {
        acumular(g.categoriaId, g.categoria, g.cantidad);
      }
    });

    const totalGastos = Array.from(montosPorCategoria.values()).reduce((sum, c) => sum + c.monto, 0);
    const gastosPorCategoria: IGastoPorCategoria[] = Array.from(montosPorCategoria.entries())
      .map(([categoriaId, datos]) => ({
        categoriaId,
        nombre: datos.nombre,
        color: datos.color,
        monto: datos.monto,
        porcentaje: totalGastos > 0 ? (datos.monto / totalGastos) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto);

    // Próximos movimientos (más cercanos primero)
    const proximosGastos: IProximoMovimiento[] = gastosDomiciliados.map((g) => ({
      id: `gasto-${g.id}`,
      tipo: 'gasto_domiciliado' as const,
      nombre: g.nombre,
      cantidad: g.cantidad,
      frecuencia: g.frecuencia,
      proximaFecha: (
        g.frecuencia === 'semanal'
          ? calcularProximaFechaSemanal(parseDiasSemana(g.diasSemana), hoy)
          : calcularProximaFechaMensual(g.fechaCobro ?? 1, hoy)
      ).toISOString(),
      categoriaColor: g.categoria?.color,
    }));
    const proximosAhorros: IProximoMovimiento[] = ahorrosDomiciliados.map((a) => ({
      id: `ahorro-${a.id}`,
      tipo: 'ahorro_domiciliado' as const,
      nombre: a.nombre,
      cantidad: a.cantidad,
      frecuencia: a.frecuencia,
      proximaFecha: (
        a.frecuencia === 'semanal'
          ? calcularProximaFechaSemanal(parseDiasSemana(a.diasSemana), hoy)
          : calcularProximaFechaDesdeInicio(new Date(a.fechaInicio), a.frecuencia, hoy)
      ).toISOString(),
    }));
    const proximosMovimientos = [...proximosGastos, ...proximosAhorros]
      .sort((a, b) => new Date(a.proximaFecha).getTime() - new Date(b.proximaFecha).getTime())
      .slice(0, 5);

    const resumen: IDashboardResumen = {
      ahorroTotal,
      ahorrosLugares: ahorrosLugares.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        tipo: a.tipo as IAhorroLugar['tipo'],
        saldoActual: a.saldoActual,
        notas: a.notas ?? undefined,
        fechaCreacion: a.fechaCreacion,
      })),
      deudaTarjetas,
      deudaTarjetasTotal,
      gastosPorCategoria,
      proximosMovimientos,
      periodos: { mes, quincena1, quincena2 },
    };

    return Response.json(resumen);
  } catch (error) {
    console.error('Error en dashboard:', error);
    return Response.json({ error: 'Error al calcular el dashboard' }, { status: 500 });
  }
}

function formatearRango(rango: RangoFechas): string {
  return `${formatearDiaMes(rango.inicio)} - ${formatearDiaMes(rango.fin)}`;
}
