// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import { materializarDomiciliados, materializarIngresos, montoUtilizadoDeposito, CLAVE_SALDO_DISPONIBLE } from '@/lib/finanzas';
import { gastoNeto, calcularDeudaTarjeta, calcularEstadoDeposito } from '@/utils/finanzas';
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
  IItemPresupuesto,
} from '@/types';
import type { Ingreso, Prisma } from '@prisma/client';

type GastoFijoConCategoria = Prisma.GastoFijoGetPayload<{ include: { categoria: true } }>;
type GastoDomiciliadoConCategoria = Prisma.GastoDomiciliadoGetPayload<{ include: { categoria: true } }>;
type GastoVariableConTodo = Prisma.GastoVariableGetPayload<{ include: { categoria: true; devoluciones: true } }>;
type CompraTarjetaConTodo = Prisma.CompraTarjetaGetPayload<{ include: { categoria: true; devoluciones: true } }>;
type AhorroDomiciliado = Prisma.AhorroDomiciliadoGetPayload<Record<string, never>>;
type PagoTarjeta = Prisma.PagoTarjetaGetPayload<Record<string, never>>;
type MovimientoAhorro = Prisma.MovimientoAhorroGetPayload<Record<string, never>>;

// Días de pago del usuario: quincenas de 10 a 25 y de 26 al 10 del mes siguiente
const CORTE_1 = 10;
const CORTE_2 = 25;

interface OcurrenciaTag {
  nombre: string;
  cantidad: number;
  fecha: Date;
  tipo: 'gasto' | 'ahorro';
  categoriaColor?: string;
  categoriaNombre?: string;
  categoriaTipoPresupuesto?: string | null;
}

interface CargoTarjetaDomiciliado {
  nombre: string;
  cantidad: number;
  fecha: Date;
  pagadoAdelantado: boolean;
}

// Meta de "% destinado a": 50% necesidades, 20% gustos (del ingreso del periodo),
// y un monto fijo de ahorro por quincena (independiente del ingreso).
const META_NECESIDADES_PCT = 50;
const META_GUSTOS_PCT = 20;
const META_AHORRO_QUINCENAL = 3000;

function clasificarPresupuesto(tipo: string | null | undefined): 'necesidad' | 'gusto' {
  return tipo === 'necesidad' ? 'necesidad' : 'gusto';
}

/** Cantidad neta de un gasto/compra ya registrado, restando sus devoluciones. */
function neto(item: { cantidad: number; devoluciones: { cantidad: number }[] }): number {
  return gastoNeto(item.cantidad, item.devoluciones);
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
  gastosVariables: GastoVariableConTodo[],
  comprasTarjeta: CompraTarjetaConTodo[],
  pagosTarjeta: PagoTarjeta[],
  movimientosAhorro: MovimientoAhorro[],
  saldoDisponibleManual: number
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
  //
  // Los gastos domiciliados EN EFECTIVO (sin tarjetaId) ya se materializan en
  // GastoVariable real en cuanto llega su fecha (ver materializarDomiciliados en
  // src/lib/finanzas.ts) -- así que aquí solo se proyectan sus ocurrencias
  // FUTURAS (para "pendiente"/"dinero comprometido"); las pasadas se leen más
  // abajo desde gastosVariables (ya son filas reales). Los ligados a una
  // tarjeta (tarjetaId != null) nunca se materializan: siguen siendo
  // proyección + el checkbox manual "ya pagué este cargo", y van aparte en
  // `cargosTarjetaDomiciliada` (no restan disponible salvo que estén marcados).
  const ocurrencias: OcurrenciaTag[] = [];
  const cargosTarjetaDomiciliada: CargoTarjetaDomiciliado[] = [];
  const gastosFijosActivos = gastosFijos.filter((g) => g.activo);
  const gastosDomActivos = gastosDomiciliados.filter((g) => g.activo);
  const ahorrosDomActivos = ahorrosDomiciliados.filter((a) => a.activo);

  const estaMarcadoPagado = (g: GastoDomiciliadoConCategoria, fecha: Date) =>
    !!(g.pagadoAdelantadoHasta && new Date(g.pagadoAdelantadoHasta) >= fecha);

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
            categoriaNombre: g.categoria.nombre,
            categoriaTipoPresupuesto: g.categoria.tipoPresupuesto,
          });
        }
      });
    });

    gastosDomActivos
      .filter((g) => g.frecuencia !== 'semanal' && g.fechaCobro != null)
      .forEach((g) => {
        ocurrenciasDelMes(g.fechaCobro as number, g.frecuencia, g.cantidad, año, mes, CORTE_1).forEach((oc) => {
          if (!fechaEnRangos(oc.fecha, rangos)) return;
          if (g.tarjetaId != null) {
            cargosTarjetaDomiciliada.push({
              nombre: g.nombre,
              cantidad: oc.cantidad,
              fecha: oc.fecha,
              pagadoAdelantado: estaMarcadoPagado(g, oc.fecha),
            });
            return;
          }
          if (oc.fecha <= hoyFinDelDia) return; // ya materializado, se lee de gastosVariables
          ocurrencias.push({
            nombre: g.nombre,
            cantidad: oc.cantidad,
            fecha: oc.fecha,
            tipo: 'gasto',
            categoriaColor: g.categoria.color,
            categoriaNombre: g.categoria.nombre,
            categoriaTipoPresupuesto: g.tipoPresupuesto ?? g.categoria.tipoPresupuesto,
          });
        });
      });

    ahorrosDomActivos
      .filter((a) => a.frecuencia !== 'semanal')
      .forEach((a) => {
        const dia = diaMexico(new Date(a.fechaInicio));
        ocurrenciasDelMes(dia, a.frecuencia, a.cantidad, año, mes, CORTE_1).forEach((oc) => {
          if (fechaEnRangos(oc.fecha, rangos) && oc.fecha > hoyFinDelDia) {
            ocurrencias.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' });
          }
        });
      });
  }

  gastosDomActivos
    .filter((g) => g.frecuencia === 'semanal')
    .forEach((g) => {
      ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, rangos).forEach((oc) => {
        if (g.tarjetaId != null) {
          cargosTarjetaDomiciliada.push({
            nombre: g.nombre,
            cantidad: oc.cantidad,
            fecha: oc.fecha,
            pagadoAdelantado: estaMarcadoPagado(g, oc.fecha),
          });
          return;
        }
        if (oc.fecha <= hoyFinDelDia) return;
        ocurrencias.push({
          nombre: g.nombre,
          cantidad: oc.cantidad,
          fecha: oc.fecha,
          tipo: 'gasto',
          categoriaColor: g.categoria.color,
          categoriaNombre: g.categoria.nombre,
          categoriaTipoPresupuesto: g.tipoPresupuesto ?? g.categoria.tipoPresupuesto,
        });
      });
    });

  ahorrosDomActivos
    .filter((a) => a.frecuencia === 'semanal')
    .forEach((a) => {
      ocurrenciasSemanales(parseDiasSemana(a.diasSemana), a.cantidad, rangos).forEach((oc) => {
        if (oc.fecha > hoyFinDelDia) {
          ocurrencias.push({ nombre: a.nombre, cantidad: oc.cantidad, fecha: oc.fecha, tipo: 'ahorro' });
        }
      });
    });

  // Gastos variables reales en el periodo: los que el usuario registró a mano y
  // los que se materializaron de un gasto domiciliado en efectivo. Se excluyen
  // los pagados con dinero de un tercero (regla 8: no son gasto tuyo).
  const gastosVariablesEnPeriodo = gastosVariables.filter((g) => fechaEnRangos(new Date(g.fecha), rangos));
  const gastosPropiosEnPeriodo = gastosVariablesEnPeriodo.filter((g) => g.fuente !== 'tercero');
  const gastosManualesPropios = gastosPropiosEnPeriodo.filter((g) => g.gastoDomiciliadoOrigenId == null);
  const gastosMaterializadosFijos = gastosPropiosEnPeriodo.filter((g) => g.gastoDomiciliadoOrigenId != null);

  const comprasTarjetaEnPeriodo = comprasTarjeta.filter((c) => fechaEnRangos(new Date(c.fecha), rangos));

  const movimientosAhorroEnPeriodo = movimientosAhorro.filter((m) => fechaEnRangos(new Date(m.fecha), rangos));
  // Ahorro domiciliado ya materializado en este periodo (transferencia real disponible->ahorro).
  const ahorroDomiciliadoMaterializadoPeriodo = movimientosAhorroEnPeriodo
    .filter((m) => m.origen === 'domiciliado')
    .reduce((s, m) => s + m.cantidad, 0);

  const sumar = (ocs: OcurrenciaTag[], pagado: boolean) =>
    ocs.filter((oc) => (oc.fecha <= hoyFinDelDia) === pagado).reduce((s, oc) => s + oc.cantidad, 0);

  const gastoOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'gasto');
  const ahorroOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'ahorro');

  // "Pagado" de gastos fijos = GastoFijo ya ocurrido (virtual, sin materializar) +
  // domiciliados en efectivo ya materializados este periodo (filas reales).
  const gastosFijosPagado =
    sumar(gastoOcurrencias, true) + gastosMaterializadosFijos.reduce((s, g) => s + neto(g), 0);
  const gastosFijosPendiente = sumar(gastoOcurrencias, false);
  const ahorroDelMesPagado = ahorroDomiciliadoMaterializadoPeriodo;
  const ahorroDelMesPendiente = sumar(ahorroOcurrencias, false);
  const gastosVariablesPeriodo = gastosManualesPropios.reduce((s, g) => s + neto(g), 0);

  // "Dinero disponible" ya NO se calcula a partir del ingreso del periodo: ese
  // cálculo nunca puede igualar tu saldo real de banco porque la app no ve tu
  // historial completo (intereses, comisiones, movimientos de años previos).
  // En su lugar es un saldo que tú mantienes al día a mano (igual que tus
  // cuentas de ahorro), guardado en Configuracion -- ver saldoDisponibleManual.
  const dineroDisponible = saldoDisponibleManual;
  const dineroComprometido = gastosFijosPendiente + ahorroDelMesPendiente;
  // "Dinero real": tu saldo real de hoy, pero imaginando que también se liquidan
  // los pendientes de este periodo (gastos fijos y ahorros que aún no llegan). La
  // deuda de tarjeta no se resta aquí porque no necesariamente se paga en esta quincena.
  const dineroReal = dineroDisponible - dineroComprometido;

  // "% destinado a": cuánto de lo ya gastado/ahorrado este periodo fue a necesidades,
  // gustos o ahorro, comparado contra una meta (50% / 20% / monto fijo de ahorro).
  // También se arma el detalle (items) de qué gastos componen cada rubro, para el popup.
  // Incluye gastos fijos manuales ya ocurridos (gastoOcurrencias aquí solo trae GastoFijo
  // en el pasado -- los domiciliados en efectivo ya están en gastosManualesPropios/
  // gastosMaterializadosFijos, materializados) + compras de tarjeta; excluye lo pagado
  // con dinero de un tercero.
  const gastosFijosPagados = gastoOcurrencias.filter((oc) => oc.fecha <= hoyFinDelDia);
  const gastosParaPresupuesto = [...gastosManualesPropios, ...gastosMaterializadosFijos];
  const itemsPorTipo = (tipo: 'necesidad' | 'gusto'): IItemPresupuesto[] => [
    ...gastosFijosPagados
      .filter((oc) => clasificarPresupuesto(oc.categoriaTipoPresupuesto) === tipo)
      .map((oc) => ({ nombre: oc.nombre, cantidad: oc.cantidad, categoriaNombre: oc.categoriaNombre, categoriaColor: oc.categoriaColor })),
    ...gastosParaPresupuesto
      .filter((g) => clasificarPresupuesto(g.tipoPresupuesto ?? g.categoria.tipoPresupuesto) === tipo)
      .map((g) => ({ nombre: g.nombre, cantidad: neto(g), categoriaNombre: g.categoria.nombre, categoriaColor: g.categoria.color })),
    ...comprasTarjetaEnPeriodo
      .filter((c) => clasificarPresupuesto(c.tipoPresupuesto ?? c.categoria?.tipoPresupuesto) === tipo)
      .map((c) => ({ nombre: c.nombre, cantidad: neto(c), categoriaNombre: c.categoria?.nombre, categoriaColor: c.categoria?.color })),
  ];

  const itemsNecesidades = itemsPorTipo('necesidad');
  const itemsGustos = itemsPorTipo('gusto');
  // El ahorro ya ocurrido de este periodo viene de las filas reales materializadas
  // (ahorroOcurrencias, aquí, solo tiene lo FUTURO -- ver el filtro más arriba).
  const itemsAhorro: IItemPresupuesto[] = movimientosAhorroEnPeriodo
    .filter((m) => m.origen === 'domiciliado')
    .map((m) => ({ nombre: m.concepto, cantidad: m.cantidad }));

  const necesidadesMonto = itemsNecesidades.reduce((s, i) => s + i.cantidad, 0);
  const gustosMonto = itemsGustos.reduce((s, i) => s + i.cantidad, 0);
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
      items: itemsNecesidades.sort((a, b) => b.cantidad - a.cantidad),
    },
    gustos: {
      monto: gustosMonto,
      porcentaje: calcularPorcentaje(gustosMonto, ingresosPeriodo),
      metaMonto: metaGustosMonto,
      metaPorcentaje: META_GUSTOS_PCT,
      items: itemsGustos.sort((a, b) => b.cantidad - a.cantidad),
    },
    ahorro: {
      monto: ahorroMonto,
      porcentaje: calcularPorcentaje(ahorroMonto, ingresosPeriodo),
      metaMonto: metaAhorroMonto,
      metaPorcentaje: calcularPorcentaje(metaAhorroMonto, ingresosPeriodo),
      items: itemsAhorro.sort((a, b) => b.cantidad - a.cantidad),
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
    ...gastosMaterializadosFijos.map((g) => ({
      nombre: g.nombre,
      cantidad: neto(g),
      fecha: new Date(g.fecha).toISOString(),
      tipo: 'gasto' as const,
      pagado: true,
      categoriaColor: g.categoria.color,
    })),
    ...gastosManualesPropios.map((g) => ({
      nombre: g.nombre,
      cantidad: neto(g),
      fecha: new Date(g.fecha).toISOString(),
      tipo: 'gasto' as const,
      pagado: true,
      categoriaColor: g.categoria.color,
    })),
    ...cargosTarjetaDomiciliada.map((c) => ({
      nombre: c.nombre,
      cantidad: c.cantidad,
      fecha: c.fecha.toISOString(),
      tipo: 'gasto' as const,
      pagado: c.pagadoAdelantado,
      credito: true,
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
    dineroComprometido,
    dineroReal,
    porcentajeDestino,
    movimientos,
  };
}

export async function GET() {
  try {
    // Convierte en filas reales (GastoVariable / MovimientoAhorro) los domiciliados
    // en efectivo y de ahorro cuya fecha ya llegó. Idempotente -- no hace nada si ya
    // está al día. Los domiciliados de tarjeta no se tocan (siguen siendo checkbox manual).
    await materializarDomiciliados();
    // Acredita al saldo disponible los ingresos (nómina, etc.) cuya fecha de
    // pago ya llegó desde la última vez. También idempotente.
    await materializarIngresos();

    const [
      ingresos,
      ahorrosLugares,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosFijos,
      gastosVariables,
      tarjetas,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro,
      depositosTerceros,
      configSaldo,
    ] = await Promise.all([
      prisma.ingreso.findMany({ where: { activo: true } }),
      prisma.ahorroLugar.findMany(),
      prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
      prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.gastoVariable.findMany({ include: { categoria: true, devoluciones: true } }),
      prisma.tarjetaCredito.findMany({ where: { activa: true } }),
      prisma.compraTarjeta.findMany({ include: { categoria: true, devoluciones: true } }),
      prisma.pagoTarjeta.findMany(),
      prisma.movimientoAhorro.findMany(),
      prisma.depositoTercero.findMany({ include: { gastosVariables: true, pagosTarjeta: true } }),
      prisma.configuracion.findUnique({ where: { clave: CLAVE_SALDO_DISPONIBLE } }),
    ]);

    const saldoDisponibleManual = configSaldo ? parseFloat(configSaldo.valor) : 0;

    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);
    const dineroTerceroPendiente = depositosTerceros.reduce(
      (sum, d) => sum + calcularEstadoDeposito(d.cantidad, montoUtilizadoDeposito(d)).pendiente,
      0
    );

    const hoy = hoyMexico();
    const rangoMes = rangoMesActual(hoy);
    const periodoActual = periodoQuincenaActual(hoy, CORTE_1, CORTE_2);
    const periodoProximo = periodoQuincenaSiguiente(periodoActual, CORTE_1, CORTE_2);

    // Deuda de tarjetas: todo lo que llevas comprado (haya cortado o no, incluye MSI
    // completo), menos devoluciones, más los gastos domiciliados ligados a esta
    // tarjeta que ya cayeron y no se marcaron como pagados, menos lo que ya abonaste.
    const deudaTarjetas: IDeudaTarjeta[] = tarjetas.map((t) => {
      const comprado = comprasTarjeta
        .filter((c) => c.tarjetaId === t.id)
        .reduce((sum, c) => sum + neto(c), 0);
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

      const debe = calcularDeudaTarjeta(comprado, pagado, cargosDomiciliados);
      return {
        id: t.id,
        nombre: t.nombre,
        debe,
        pagoQuincenal: t.pagoQuincenal ?? undefined,
        diaCorte: t.diaCorte,
      };
    });
    const deudaTarjetasTotal = deudaTarjetas.reduce((sum, t) => sum + t.debe, 0);

    const args = [
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosVariables,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro,
      saldoDisponibleManual,
    ] as const;

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

    // Gastos por categoría del mes (fijos + domiciliados de tarjeta (proyección) +
    // reales del mes: variables manuales/materializados + compras de tarjeta).
    // Los domiciliados EN EFECTIVO ya no se proyectan aquí -- ya están en
    // `gastosVariables` (materializados) para evitar contarlos dos veces.
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
    gastosDomiciliados
      .filter((g) => g.activo && g.tarjetaId != null)
      .forEach((g) => {
        if (g.frecuencia === 'semanal') {
          const ocurrencias = ocurrenciasSemanales(parseDiasSemana(g.diasSemana), g.cantidad, [rangoMes]);
          acumular(g.categoriaId, g.categoria, ocurrencias.reduce((sum, oc) => sum + oc.cantidad, 0));
        } else {
          acumular(g.categoriaId, g.categoria, g.frecuencia === 'quincenal' ? g.cantidad * 2 : g.cantidad);
        }
      });
    gastosVariables.forEach((g) => {
      if (g.fuente !== 'tercero' && fechaEnRangos(new Date(g.fecha), [rangoMes])) {
        acumular(g.categoriaId, g.categoria, neto(g));
      }
    });
    comprasTarjeta.forEach((c) => {
      if (fechaEnRangos(new Date(c.fecha), [rangoMes])) {
        acumular(c.categoriaId, c.categoria, neto(c));
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
      dineroTerceroPendiente,
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
