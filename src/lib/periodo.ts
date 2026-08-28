// src/lib/periodo.ts
//
// Construye el resumen financiero completo (ingresos, gastos fijos, ahorro,
// dinero disponible/real, % destinado a, y el detalle de movimientos) de un
// periodo de fechas cualquiera. Lo usan tanto el Dashboard (quincena actual,
// próxima y mes en curso, con `hoy` = hoy de verdad) como el detalle de un
// mes pasado en Historial Mensual (con el mismo `hoy`, para que "pagado"
// siga significando "ya ocurrió" y no dependa de en qué mes se esté viendo).
import { gastoNeto, calcularDineroDisponible } from '@/utils/finanzas';
import {
  ocurrenciasDelMes,
  ocurrenciasSemanales,
  parseDiasSemana,
  finDelDia,
  fechaEnRangos,
  mesesTocados,
  diaMexico,
  calcularPorcentaje,
  type RangoFechas,
} from '@/utils/calculos';
import type {
  IMovimientoPeriodo,
  IResumenPeriodo,
  IFuenteDinero,
  IPorcentajeDestino,
  IItemPresupuesto,
  IPorcentajesMeta,
} from '@/types';
import type { Ingreso, Prisma } from '@prisma/client';

export type GastoFijoConCategoria = Prisma.GastoFijoGetPayload<{ include: { categoria: true } }>;
export type GastoDomiciliadoConCategoria = Prisma.GastoDomiciliadoGetPayload<{ include: { categoria: true } }>;
export type GastoVariableConTodo = Prisma.GastoVariableGetPayload<{ include: { categoria: true; devoluciones: true } }>;
export type CompraTarjetaConTodo = Prisma.CompraTarjetaGetPayload<{ include: { categoria: true; devoluciones: true } }>;
export type AhorroDomiciliado = Prisma.AhorroDomiciliadoGetPayload<Record<string, never>>;
export type PagoTarjeta = Prisma.PagoTarjetaGetPayload<Record<string, never>>;
export type MovimientoAhorro = Prisma.MovimientoAhorroGetPayload<Record<string, never>>;

// Días de pago del usuario: quincenas de 10 a 24 y de 25 al 9 del mes siguiente
export const CORTE_1 = 10;
export const CORTE_2 = 25;

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
  /** Solo en ocurrencias tipo="ahorro": si es false, no cuenta como "dinero comprometido" -- se puede dejar de ahorrar sin que afecte Dinero real (ver ahorroDelMesPendiente). */
  obligatorio?: boolean;
}

export interface CargoTarjetaDomiciliado {
  nombre: string;
  cantidad: number;
  fecha: Date;
  pagadoAdelantado: boolean;
}

function clasificarPresupuesto(tipo: string | null | undefined): 'necesidad' | 'gusto' {
  return tipo === 'necesidad' ? 'necesidad' : 'gusto';
}

/** Cantidad neta de un gasto/compra ya registrado, restando sus devoluciones. */
function neto(item: { cantidad: number; devoluciones: { cantidad: number }[] }): number {
  return gastoNeto(item.cantidad, item.devoluciones);
}

export function construirPeriodo(
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
  metas: IPorcentajesMeta
): IResumenPeriodo {
  const hoyFinDelDia = finDelDia(hoy);

  // Ingreso no tiene un día fijo como los gastos domiciliados, así que se prorratea
  // según el tipo de periodo: una quincena ve una vez el monto quincenal (y la mitad
  // del mensual); el mes completo ve el doble del quincenal (dos quincenas) y el
  // mensual completo. Es el ingreso "de esta quincena" -- el punto de partida de
  // "Dinero disponible" de este periodo específico (ver más abajo).
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
              obligatorio: a.obligatorio,
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
            obligatorio: a.obligatorio,
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
  const pagosTarjetaEnPeriodo = pagosTarjeta.filter((p) => fechaEnRangos(new Date(p.fecha), rangos));

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

  // Los cargos domiciliados de tarjeta (Colegiatura, Chat GPT, etc.) SÍ son
  // gasto fijo -- solo que se pagan con crédito en vez de efectivo. Cuentan
  // para el total de "Gastos fijos" y para "Dinero real" (dineroComprometido,
  // más abajo) igual que cualquier otro gasto fijo pendiente, pero NO tocan
  // "Dinero disponible" -- ese solo baja cuando pagas la tarjeta de verdad
  // (ver efectoPagoTarjeta). "Pagado" aquí es el mismo checkbox "ya pagué
  // este cargo" (pagadoAdelantadoHasta) que ya se usa en /tarjetas.
  const cargosTarjetaPagados = cargosTarjetaDomiciliada
    .filter((c) => c.pagadoAdelantado)
    .reduce((s, c) => s + c.cantidad, 0);
  const cargosTarjetaPendientes = cargosTarjetaDomiciliada
    .filter((c) => !c.pagadoAdelantado)
    .reduce((s, c) => s + c.cantidad, 0);

  // "Pagado" de gastos fijos = GastoFijo ya ocurrido (virtual, sin materializar) +
  // domiciliados en efectivo ya confirmados este periodo (filas reales) +
  // cargos de tarjeta ya marcados como pagados.
  const gastosFijosPagado =
    sumar(gastoFijoOcurrencias, true) +
    gastosMaterializadosFijos.reduce((s, g) => s + neto(g), 0) +
    cargosTarjetaPagados;
  // Pendiente = GastoFijo cuya fecha aún no llega + TODO gasto domiciliado en
  // efectivo sin confirmar de este periodo (haya pasado su fecha o no) +
  // cargos de tarjeta sin marcar como pagados.
  const gastosFijosPendiente =
    sumar(gastoFijoOcurrencias, false) +
    gastoDomOcurrencias.reduce((s, oc) => s + oc.cantidad, 0) +
    cargosTarjetaPendientes;
  const ahorroDelMesPagado = ahorroDomiciliadoMaterializadoPeriodo;
  // Todas las ocurrencias de ahorro que quedan en `ahorroOcurrencias` son, por
  // construcción, las que aún no se marcaron como enviadas (ver el filtro
  // `!estaEnviado` más arriba) -- no hay que separarlas por fecha, porque aquí
  // "pendiente" no depende de si ya pasó la fecha. Solo las obligatorias
  // cuentan como "dinero comprometido" -- un ahorro marcado como opcional
  // (ej. VOO) sigue apareciendo en el detalle para confirmarlo si se quiere,
  // pero no obliga a apartarle dinero ni baja "Dinero real" si no se hace.
  const ahorroDelMesPendiente = ahorroOcurrencias
    .filter((oc) => oc.obligatorio !== false)
    .reduce((s, oc) => s + oc.cantidad, 0);
  const gastosVariablesPeriodo = gastosManualesPropios.reduce((s, g) => s + neto(g), 0);

  // "Dinero disponible" de ESTE periodo: el ingreso de esta quincena/mes menos
  // lo que ya salió de verdad en este mismo periodo (gastos y pagos de tarjeta
  // con fuente="disponible", movimientos de ahorro) -- nunca se guarda ni se
  // corrige a mano, se recalcula de cero cada vez a partir de las filas reales
  // (ver calcularDineroDisponible en src/utils/finanzas.ts). Cada quincena
  // tiene su propio arranque (el ingreso de esa quincena); "Mes" no se calcula
  // aparte, es la suma de las dos quincenas (se sobreescribe en GET()).
  const dineroDisponible = calcularDineroDisponible({
    ingresoAcumulado: ingresosPeriodo,
    gastosVariables: gastosPropiosEnPeriodo.map((g) => ({
      cantidad: g.cantidad,
      fuente: g.fuente as IFuenteDinero,
      devoluciones: g.devoluciones,
    })),
    pagosTarjeta: pagosTarjetaEnPeriodo.map((p) => ({ cantidad: p.cantidad, fuente: p.fuente as IFuenteDinero })),
    movimientosAhorro: movimientosAhorroEnPeriodo.map((m) => ({
      cantidad: m.cantidad,
      tipo: m.tipo as 'deposito' | 'retiro',
      origen: m.origen as 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta',
    })),
  });
  const dineroComprometido = gastosFijosPendiente + ahorroDelMesPendiente;
  // "Dinero real": tu saldo de este periodo (dineroDisponible), pero
  // imaginando que también se liquidan los pendientes de este mismo periodo
  // (gastos fijos y ahorro que aún no se confirman). La deuda de tarjeta no
  // se resta aquí -- vive aparte, en "Deuda de tarjetas".
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

  const metaNecesidadesMonto = (ingresosPeriodo * metas.necesidades) / 100;
  const metaGustosMonto = (ingresosPeriodo * metas.gustos) / 100;
  const metaAhorroMonto = (ingresosPeriodo * metas.ahorro) / 100;

  const porcentajeDestino: IPorcentajeDestino = {
    necesidades: {
      monto: necesidadesMonto,
      porcentaje: calcularPorcentaje(necesidadesMonto, ingresosPeriodo),
      metaMonto: metaNecesidadesMonto,
      metaPorcentaje: metas.necesidades,
      items: itemsNecesidades.sort((a, b) => b.cantidad - a.cantidad),
    },
    gustos: {
      monto: gustosMonto,
      porcentaje: calcularPorcentaje(gustosMonto, ingresosPeriodo),
      metaMonto: metaGustosMonto,
      metaPorcentaje: metas.gustos,
      items: itemsGustos.sort((a, b) => b.cantidad - a.cantidad),
    },
    ahorro: {
      monto: ahorroMonto,
      porcentaje: calcularPorcentaje(ahorroMonto, ingresosPeriodo),
      metaMonto: metaAhorroMonto,
      metaPorcentaje: metas.ahorro,
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
      obligatorio: oc.tipo === 'ahorro' ? oc.obligatorio !== false : undefined,
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
