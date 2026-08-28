// src/types/index.ts

export interface ICategoria {
  id: number;
  nombre: string;
  color: string;
  icono?: string;
  esDelSistema: boolean;
  tipoPresupuesto?: 'necesidad' | 'gusto';
}

export interface IIngreso {
  id: number;
  nombre: string;
  cantidad: number;
  frecuencia: 'mensual' | 'quincenal' | 'unico';
  fechaInicio: Date;
  activo: boolean;
  notas?: string;
}

export interface IAhorroLugar {
  id: number;
  nombre: string;
  tipo: 'cuenta_ahorro' | 'inversion' | 'efectivo' | 'otra';
  saldoActual: number;
  notas?: string;
  fechaCreacion: Date;
}

export interface IGastoDomiciliado {
  id: number;
  nombre: string;
  cantidad: number;
  fechaCobro?: number;
  frecuencia: 'mensual' | 'quincenal' | 'semanal';
  diasSemana?: string;
  categoriaId: number;
  categoria?: ICategoria;
  cuentaPago: string;
  tarjetaId?: number;
  tarjeta?: ITarjetaCredito;
  /** Solo aplica si tarjetaId != null: hasta qué fecha de cobro ya se marcó "ya pagué este cargo". */
  pagadoAdelantadoHasta?: string;
  /** Solo aplica si tarjetaId == null (efectivo): hasta qué fecha ya se generó un GastoVariable real. */
  ultimaOcurrenciaMaterializada?: string;
  tipoPresupuesto?: 'necesidad' | 'gusto';
  activo: boolean;
  notas?: string;
}

export interface IAhorroDomiciliado {
  id: number;
  nombre: string;
  cantidad: number;
  frecuencia: 'mensual' | 'quincenal' | 'semanal';
  diasSemana?: string;
  ahorroDestinoId: number;
  ahorroDestino?: IAhorroLugar;
  ultimaOcurrenciaMaterializada?: string;
  /** Hasta qué fecha de ocurrencia ya se marcó "ya lo envié" (crea el movimiento real y descuenta disponible). */
  enviadoHasta?: string;
  /** Si es false, no cuenta como "dinero comprometido" -- se puede dejar de ahorrar sin que afecte Dinero real (ej. VOO). Default true. */
  obligatorio: boolean;
  activo: boolean;
  notas?: string;
}

export interface IGastoFijo {
  id: number;
  nombre: string;
  cantidad: number;
  categoriaId: number;
  fechaPago: number;
  activo: boolean;
  notas?: string;
}

export type IFuenteDinero = 'disponible' | 'ahorro' | 'tercero';

export interface IGastoVariable {
  id: number;
  nombre: string;
  cantidad: number;
  categoriaId: number;
  categoria?: ICategoria;
  fecha: Date;
  notas?: string;
  tipoPresupuesto?: 'necesidad' | 'gusto';
  fuente: IFuenteDinero;
  ahorroLugarId?: number;
  ahorroLugar?: IAhorroLugar;
  depositoTerceroId?: number;
  depositoTercero?: IDepositoTercero;
  gastoDomiciliadoOrigenId?: number;
  devoluciones?: IDevolucion[];
}

export interface ITarjetaCredito {
  id: number;
  nombre: string;
  diaCorte: number;
  pagoQuincenal?: number;
  activa: boolean;
  notas?: string;
}

export interface IDeudaTarjeta {
  id: number;
  nombre: string;
  debe: number;
  pagoQuincenal?: number;
  diaCorte: number;
}

export interface ICompraTarjeta {
  id: number;
  nombre: string;
  cantidad: number;
  fecha: string;
  tarjetaId: number;
  tarjeta?: ITarjetaCredito;
  categoriaId?: number;
  categoria?: ICategoria;
  notas?: string;
  tipoPresupuesto?: 'necesidad' | 'gusto';
  /** Meses sin intereses; null/undefined = de contado. */
  numeroMeses?: number;
  montoMensual?: number;
  devoluciones?: IDevolucion[];
}

export interface IPagoTarjeta {
  id: number;
  cantidad: number;
  fecha: string;
  concepto?: string;
  tarjetaId: number;
  tarjeta?: ITarjetaCredito;
  fuente: IFuenteDinero;
  ahorroLugarId?: number;
  ahorroLugar?: IAhorroLugar;
  depositoTerceroId?: number;
  depositoTercero?: IDepositoTercero;
  compraTarjetaId?: number;
}

export interface IMovimientoAhorro {
  id: number;
  ahorroId: number;
  ahorro?: IAhorroLugar;
  tipo: 'deposito' | 'retiro';
  cantidad: number;
  fecha: string;
  concepto: string;
  /** "manual" | "domiciliado" | "pago_gasto" | "pago_tarjeta" */
  origen: 'manual' | 'domiciliado' | 'pago_gasto' | 'pago_tarjeta';
  ahorroDomiciliadoOrigenId?: number;
}

export interface IDepositoTercero {
  id: number;
  persona: string;
  cantidad: number;
  concepto: string;
  fecha: string;
  pagoRelacionado?: string;
  notas?: string;
  /** Calculados al leer, no se guardan: cantidad - suma de gastos/pagos vinculados. */
  montoUtilizado: number;
  pendiente: number;
  estado: 'pendiente' | 'parcial' | 'utilizado';
  /** En qué gastos/pagos se usó este depósito. */
  usos?: { nombre: string; cantidad: number; fecha: string }[];
}

export interface IDevolucion {
  id: number;
  cantidad: number;
  fecha: string;
  concepto?: string;
  gastoVariableId?: number;
  compraTarjetaId?: number;
}

export interface IGastoPorCategoria {
  categoriaId: number;
  nombre: string;
  color: string;
  monto: number;
  porcentaje: number;
}

export interface IProximoMovimiento {
  id: string;
  tipo: 'gasto_domiciliado' | 'ahorro_domiciliado';
  nombre: string;
  cantidad: number;
  frecuencia: string;
  proximaFecha: string;
  categoriaColor?: string;
}

export interface IMovimientoPeriodo {
  nombre: string;
  cantidad: number;
  fecha: string;
  tipo: 'gasto' | 'ahorro';
  pagado: boolean;
  categoriaColor?: string;
  /** true si es un cargo domiciliado de tarjeta (crédito, no efectivo) -- "pagado" aquí significa que lo marcaste con el checkbox, no que ya pasó la fecha. */
  credito?: boolean;
  /** Solo en tipo="ahorro": id del AhorroDomiciliado, para poder marcar/desmarcar "ya lo envié" con un checkbox. */
  ahorroDomiciliadoId?: number;
  /** Solo en tipo="gasto" domiciliado en efectivo (no "credito"): id del GastoDomiciliado, para poder marcar/desmarcar "ya se cobró" con un checkbox. */
  gastoDomiciliadoId?: number;
  /** Solo en tipo="ahorro": si es false, es opcional -- no cuenta como compromiso pendiente ni baja Dinero real si no se hace. */
  obligatorio?: boolean;
}

export interface IItemPresupuesto {
  nombre: string;
  cantidad: number;
  categoriaNombre?: string;
  categoriaColor?: string;
}

export interface IRubroPresupuesto {
  monto: number;
  porcentaje: number;
  metaMonto: number;
  metaPorcentaje: number;
  items: IItemPresupuesto[];
}

export interface IPorcentajeDestino {
  necesidades: IRubroPresupuesto;
  gustos: IRubroPresupuesto;
  ahorro: IRubroPresupuesto;
}

/** Los % que el usuario configuró para repartir su ingreso -- deben sumar 100. */
export interface IPorcentajesMeta {
  necesidades: number;
  gustos: number;
  ahorro: number;
}

export interface IResumenPeriodo {
  id: 'mes' | 'quincena1' | 'quincena2';
  etiqueta: string;
  inicio: string;
  fin: string;
  rangoTexto: string;
  ingresos: number;
  gastosFijos: number;
  gastosFijosPendiente: number;
  gastosVariables: number;
  ahorroDelMes: number;
  ahorroDelMesPendiente: number;
  dineroDisponible: number;
  /** Gastos fijos + ahorro programado que todavía falta que ocurra en este periodo (regla 12: "dinero comprometido"). */
  dineroComprometido: number;
  dineroReal: number;
  /** Cuánto de "Dinero disponible" es sobrante de quincenas anteriores que todavía no se gasta (ver src/app/api/dashboard/route.ts). Solo lo calcula el Dashboard -- el detalle de un mes pasado en Historial Mensual no lo trae. */
  extra?: number;
  porcentajeDestino: IPorcentajeDestino;
  movimientos: IMovimientoPeriodo[];
}

export interface IMesResumen {
  año: number;
  mes: number;
  etiqueta: string;
  actual: boolean;
  ingresos: number;
  gastos: number;
  ahorro: number;
  balance: number;
}

export interface IHistorialMensualResumen {
  año: number;
  añosDisponibles: number[];
  meses: IMesResumen[];
  totales: { ingresos: number; gastos: number; ahorro: number; balance: number };
}

export interface IMesDetalle extends IResumenPeriodo {
  año: number;
  mes: number;
  comprasTarjeta: {
    id: number;
    nombre: string;
    cantidad: number;
    fecha: string;
    tarjetaNombre: string;
    categoriaNombre?: string;
    categoriaColor?: string;
    numeroMeses?: number;
  }[];
  pagosTarjeta: {
    id: number;
    cantidad: number;
    fecha: string;
    concepto?: string;
    tarjetaNombre: string;
    fuente: IFuenteDinero;
  }[];
}

export interface IDashboardResumen {
  ahorroTotal: number;
  ahorrosLugares: IAhorroLugar[];
  deudaTarjetas: IDeudaTarjeta[];
  deudaTarjetasTotal: number;
  /** Suma de "pendiente" de todos los depósitos de terceros (regla 12: "dinero de terceros"). */
  dineroTerceroPendiente: number;
  gastosPorCategoria: IGastoPorCategoria[];
  proximosMovimientos: IProximoMovimiento[];
  periodos: {
    mes: IResumenPeriodo;
    quincena1: IResumenPeriodo;
    quincena2: IResumenPeriodo;
  };
}
