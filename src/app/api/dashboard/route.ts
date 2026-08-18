// src/app/api/dashboard/route.ts
import { prisma } from '@/lib/prisma';
import { montoIngresoAcumulado, montoUtilizadoDeposito } from '@/lib/finanzas';
import { gastoNeto, calcularDeudaTarjeta, calcularEstadoDeposito, calcularDineroDisponible } from '@/utils/finanzas';
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
  IFuenteDinero,
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

// Días de pago del usuario: quincenas de 10 a 24 y de 25 al 9 del mes siguiente
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
  /** Solo en ocurrencias tipo="ahorro" pendientes: id del AhorroDomiciliado para poder marcarlas como enviadas. */
  ahorroDomiciliadoId?: number;
  /** Solo en ocurrencias tipo="gasto" que vienen de un GastoDomiciliado en efectivo pendiente: su id, para poder confirmarlas. */
  gastoDomiciliadoId?: number;
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
  dineroDisponibleCalculado: number
): IResumenPeriodo {
  const hoyFinDelDia = finDelDia(hoy);

  // Ingreso no tiene un día fijo como los gastos domiciliados, así que se prorratea
  // según el tipo de periodo: una quincena ve una vez el monto quincenal (y la mitad
  // del mensual); el mes completo ve el doble del quincenal (dos quincenas) y el
  // mensual completo. Esto es solo para MOSTRAR el ingreso esperado de cada periodo;
  // lo que realmente se suma a "Dinero disponible" es montoIngresoAcumulado (ver GET).
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
  // periodo puede tocar hasta 2 meses de calendario (ej. 25 ago - 9 sep), así
  // que generamos las ocurrencias mensuales/quincenales para cada mes tocado.
  //
  // Ni los gastos domiciliados en efectivo NI los ahorros domiciliados se
  // materializan solo porque ya llegó su fecha (un compromiso pendiente no
  // significa que el dinero ya salió/entró) -- ambos son proyección +
  // confirmación manual con checkbox. Por eso aquí se proyectan TODAS sus
  // ocurrencias del periodo (pasadas y futuras) que no estén ya confirmadas;
  // las confirmadas se leen de gastosVariables/movimientosAhorro (ya son
  // filas reales). Los gastos domiciliados ligados a una tarjeta
  // (tarjetaId != null) son harina de otro costal: siguen siendo proyección +
  // el checkbox "ya pagué este cargo" (`pagadoAdelantadoHasta`), y van aparte
  // en `cargosTarjetaDomiciliada` -- no son "gasto fijo", son deuda de tarjeta.
  const ocurrencias: OcurrenciaTag[] = [];
  const cargosTarjetaDomiciliada: CargoTarjetaDomiciliado[] = [];
  const gastosFijosActivos = gastosFijos.filter((g) => g.activo);
  const gastosDomActivos = gastosDomiciliados.filter((g) => g.activo);
  const ahorrosDomActivos = ahorrosDomiciliados.filter((a) => a.activo);

  const estaMarcadoPagado = (g: GastoDomiciliadoConCategoria, fecha: Date) =>
    !!(g.pagadoAdelantadoHasta && new Date(g.pagadoAdelantadoHasta) >= fecha);

  // Cada ocurrencia de un domiciliado (gasto en efectivo o ahorro) es una
  // transferencia independiente -- confirmar la de esta quincena no implica
  // que la de la quincena pasada también se cobró/envió. Por eso se compara
  // contra las filas reales ya confirmadas, no contra un solo marcador
  // acumulado tipo "pagado hasta la fecha X".
  const gastoDomiciliadoConfirmado = new Set(
    gastosVariables
      .filter((g) => g.gastoDomiciliadoOrigenId != null)
      .map((g) => `${g.gastoDomiciliadoOrigenId}|${new Date(g.fecha).getTime()}`)
  );
  const estaConfirmadoGasto = (g: GastoDomiciliadoConCategoria, fecha: Date) =>
    gastoDomiciliadoConfirmado.has(`${g.id}|${fecha.getTime()}`);

  const ahorroDomiciliadoEnviado = new Set(
    movimientosAhorro
      .filter((m) => m.origen === 'domiciliado' && m.ahorroDomiciliadoOrigenId != null)
      .map((m) => `${m.ahorroDomiciliadoOrigenId}|${new Date(m.fecha).getTime()}`)
  );
  const estaEnviado = (a: AhorroDomiciliado, fecha: Date) =>
    ahorroDomiciliadoEnviado.has(`${a.id}|${fecha.getTime()}`);

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
          if (estaConfirmadoGasto(g, oc.fecha)) return; // ya confirmado, se lee de gastosVariables
          ocurrencias.push({
            nombre: g.nombre,
            cantidad: oc.cantidad,
            fecha: oc.fecha,
            tipo: 'gasto',
            categoriaColor: g.categoria.color,
            categoriaNombre: g.categoria.nombre,
            categoriaTipoPresupuesto: g.tipoPresupuesto ?? g.categoria.tipoPresupuesto,
            gastoDomiciliadoId: g.id,
          });
        });
      });

    ahorrosDomActivos
      .filter((a) => a.frecuencia !== 'semanal')
      .forEach((a) => {
        const dia = diaMexico(new Date(a.fechaInicio));
        ocurrenciasDelMes(dia, a.frecuencia, a.cantidad, año, mes, CORTE_1).forEach((oc) => {
          if (fechaEnRangos(oc.fecha, rangos) && !estaEnviado(a, oc.fecha)) {
            ocurrencias.push({
              nombre: a.nombre,
              cantidad: oc.cantidad,
              fecha: oc.fecha,
              tipo: 'ahorro',
              ahorroDomiciliadoId: a.id,
            });
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
        if (estaConfirmadoGasto(g, oc.fecha)) return;
        ocurrencias.push({
          nombre: g.nombre,
          cantidad: oc.cantidad,
          fecha: oc.fecha,
          tipo: 'gasto',
          categoriaColor: g.categoria.color,
          categoriaNombre: g.categoria.nombre,
          categoriaTipoPresupuesto: g.tipoPresupuesto ?? g.categoria.tipoPresupuesto,
          gastoDomiciliadoId: g.id,
        });
      });
    });

  ahorrosDomActivos
    .filter((a) => a.frecuencia === 'semanal')
    .forEach((a) => {
      ocurrenciasSemanales(parseDiasSemana(a.diasSemana), a.cantidad, rangos).forEach((oc) => {
        if (!estaEnviado(a, oc.fecha)) {
          ocurrencias.push({
            nombre: a.nombre,
            cantidad: oc.cantidad,
            fecha: oc.fecha,
            tipo: 'ahorro',
            ahorroDomiciliadoId: a.id,
          });
        }
      });
    });

  // Gastos variables reales en el periodo: los que el usuario registró a mano y
  // los que se confirmaron desde un gasto domiciliado en efectivo. Se excluyen
  // los pagados con dinero de un tercero (regla 8: no son gasto tuyo).
  const gastosVariablesEnPeriodo = gastosVariables.filter((g) => fechaEnRangos(new Date(g.fecha), rangos));
  const gastosPropiosEnPeriodo = gastosVariablesEnPeriodo.filter((g) => g.fuente !== 'tercero');
  const gastosManualesPropios = gastosPropiosEnPeriodo.filter((g) => g.gastoDomiciliadoOrigenId == null);
  const gastosMaterializadosFijos = gastosPropiosEnPeriodo.filter((g) => g.gastoDomiciliadoOrigenId != null);

  const comprasTarjetaEnPeriodo = comprasTarjeta.filter((c) => fechaEnRangos(new Date(c.fecha), rangos));

  const movimientosAhorroEnPeriodo = movimientosAhorro.filter((m) => fechaEnRangos(new Date(m.fecha), rangos));
  // Ahorro domiciliado ya confirmado en este periodo (transferencia real disponible->ahorro).
  const ahorroDomiciliadoMaterializadoPeriodo = movimientosAhorroEnPeriodo
    .filter((m) => m.origen === 'domiciliado')
    .reduce((s, m) => s + m.cantidad, 0);

  const sumar = (ocs: OcurrenciaTag[], pagado: boolean) =>
    ocs.filter((oc) => (oc.fecha <= hoyFinDelDia) === pagado).reduce((s, oc) => s + oc.cantidad, 0);

  const gastoOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'gasto');
  const ahorroOcurrencias = ocurrencias.filter((oc) => oc.tipo === 'ahorro');
  // GastoFijo (sin gestión en la UI hoy, pero su lógica de fecha se conserva) vs.
  // GastoDomiciliado en efectivo (siempre pendiente hasta que se confirma,
  // sin importar la fecha -- ver el filtro `!estaConfirmadoGasto` más arriba).
  const gastoFijoOcurrencias = gastoOcurrencias.filter((oc) => oc.gastoDomiciliadoId == null);
  const gastoDomOcurrencias = gastoOcurrencias.filter((oc) => oc.gastoDomiciliadoId != null);

  // "Pagado" de gastos fijos = GastoFijo ya ocurrido (virtual, sin materializar) +
  // domiciliados en efectivo ya confirmados este periodo (filas reales).
  const gastosFijosPagado =
    sumar(gastoFijoOcurrencias, true) + gastosMaterializadosFijos.reduce((s, g) => s + neto(g), 0);
  // Pendiente = GastoFijo cuya fecha aún no llega + TODO gasto domiciliado en
  // efectivo sin confirmar de este periodo (haya pasado su fecha o no).
  const gastosFijosPendiente =
    sumar(gastoFijoOcurrencias, false) + gastoDomOcurrencias.reduce((s, oc) => s + oc.cantidad, 0);
  const ahorroDelMesPagado = ahorroDomiciliadoMaterializadoPeriodo;
  // Todas las ocurrencias de ahorro que quedan en `ahorroOcurrencias` son, por
  // construcción, las que aún no se marcaron como enviadas (ver el filtro
  // `!estaEnviado` más arriba) -- no hay que separarlas por fecha, porque aquí
  // "pendiente" no depende de si ya pasó la fecha.
  const ahorroDelMesPendiente = ahorroOcurrencias.reduce((s, oc) => s + oc.cantidad, 0);
  const gastosVariablesPeriodo = gastosManualesPropios.reduce((s, g) => s + neto(g), 0);

  // "Dinero disponible" es 100% derivado (ver calcularDineroDisponible en
  // src/utils/finanzas.ts, calculado una sola vez en GET() a partir de tus
  // movimientos reales) -- nunca se guarda ni se corrige a mano, así que es
  // el mismo valor para mes/quincena1/quincena2 (siempre "tu saldo real de hoy").
  const dineroDisponible = dineroDisponibleCalculado;
  const dineroComprometido = gastosFijosPendiente + ahorroDelMesPendiente;
  // "Dinero real": tu saldo real de hoy, pero imaginando que también se liquidan
  // los pendientes de este periodo (gastos fijos y ahorros que aún no llegan). La
  // deuda de tarjeta no se resta aquí porque no necesariamente se paga en esta quincena.
  const dineroReal = dineroDisponible - dineroComprometido;

  // "% destinado a": cuánto de lo ya gastado/ahorrado este periodo fue a necesidades,
  // gustos o ahorro, comparado contra una meta (50% / 20% / monto fijo de ahorro).
  // También se arma el detalle (items) de qué gastos componen cada rubro, para el popup.
  // Incluye gastos fijos manuales ya ocurridos (gastoFijoOcurrencias aquí solo trae
  // GastoFijo en el pasado -- los domiciliados en efectivo ya están en
  // gastosManualesPropios/gastosMaterializadosFijos, confirmados) + compras de
  // tarjeta; excluye lo pagado con dinero de un tercero.
  const gastosFijosPagados = gastoFijoOcurrencias.filter((oc) => oc.fecha <= hoyFinDelDia);
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
  // El ahorro ya ocurrido de este periodo viene de las filas reales confirmadas
  // (ahorroOcurrencias, aquí, solo tiene lo pendiente -- ver el filtro más arriba).
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
      // Los GastoFijo se dan por pagados cuando ya pasó su fecha; los ahorros y
      // los gastos domiciliados en efectivo que llegan aquí son siempre los que
      // faltan por confirmar (ver los filtros `!estaEnviado`/`!estaConfirmadoGasto`
      // más arriba), sin importar la fecha.
      pagado: oc.tipo === 'ahorro' ? false : oc.gastoDomiciliadoId != null ? false : oc.fecha <= hoyFinDelDia,
      categoriaColor: oc.categoriaColor,
      ahorroDomiciliadoId: oc.ahorroDomiciliadoId,
      gastoDomiciliadoId: oc.gastoDomiciliadoId,
    })),
    ...movimientosAhorroEnPeriodo
      .filter((m) => m.origen === 'domiciliado')
      .map((m) => ({
        nombre: m.concepto,
        cantidad: m.cantidad,
        fecha: new Date(m.fecha).toISOString(),
        tipo: 'ahorro' as const,
        pagado: true,
        ahorroDomiciliadoId: m.ahorroDomiciliadoOrigenId ?? undefined,
      })),
    ...gastosMaterializadosFijos.map((g) => ({
      nombre: g.nombre,
      cantidad: neto(g),
      fecha: new Date(g.fecha).toISOString(),
      tipo: 'gasto' as const,
      pagado: true,
      categoriaColor: g.categoria.color,
      gastoDomiciliadoId: g.gastoDomiciliadoOrigenId ?? undefined,
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
    ]);

    const hoy = hoyMexico();

    // "Dinero disponible" se calcula de cero cada vez, sumando el ingreso ya
    // acreditado a la fecha y aplicando el efecto de cada movimiento real ya
    // registrado -- nunca se guarda ni se corrige a mano (ver calcularDineroDisponible).
    const ingresoAcumulado = montoIngresoAcumulado(ingresos, hoy);
    const dineroDisponibleCalculado = calcularDineroDisponible({
      ingresoAcumulado,
      gastosVariables: gastosVariables.map((g) => ({
        cantidad: g.cantidad,
        fuente: g.fuente as IFuenteDinero,
        devoluciones: g.devoluciones,
      })),
      pagosTarjeta: pagosTarjeta.map((p) => ({ cantidad: p.cantidad, fuente: p.fuente as IFuenteDinero })),
      movimientosAhorro: movimientosAhorro.map((m) => ({
        cantidad: m.cantidad,
        tipo: m.tipo as 'deposito' | 'retiro',
        origen: m.origen as 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta',
      })),
    });

    const ahorroTotal = ahorrosLugares.reduce((sum: number, ahorro) => sum + ahorro.saldoActual, 0);
    const dineroTerceroPendiente = depositosTerceros.reduce(
      (sum, d) => sum + calcularEstadoDeposito(d.cantidad, montoUtilizadoDeposito(d)).pendiente,
      0
    );

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
      dineroDisponibleCalculado,
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
    // reales del mes: variables manuales/confirmados + compras de tarjeta).
    // Los domiciliados EN EFECTIVO ya no se proyectan aquí -- ya están en
    // `gastosVariables` (una vez confirmados) para evitar contarlos dos veces.
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
