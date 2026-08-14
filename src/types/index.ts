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
  pagadoAdelantadoHasta?: string;
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

export interface IGastoVariable {
  id: number;
  nombre: string;
  cantidad: number;
  categoriaId: number;
  categoria?: ICategoria;
  fecha: Date;
  notas?: string;
  tipoPresupuesto?: 'necesidad' | 'gusto';
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
}

export interface IPagoTarjeta {
  id: number;
  cantidad: number;
  fecha: string;
  concepto?: string;
  tarjetaId: number;
  tarjeta?: ITarjetaCredito;
}

export interface IMovimientoAhorro {
  id: number;
  ahorroId: number;
  ahorro?: IAhorroLugar;
  tipo: 'deposito' | 'retiro';
  cantidad: number;
  fecha: string;
  concepto: string;
}

export interface ITransaccion {
  id: number;
  tipo: 'ingreso' | 'gasto_fijo' | 'gasto_variable' | 'ahorro' | 'transferencia';
  subtipo?: string;
  cantidad: number;
  fecha: Date;
  concepto: string;
  categoriaId?: number;
  cuenta?: string;
  estado: 'completado' | 'programado' | 'pendiente';
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
  dineroReal: number;
  porcentajeDestino: IPorcentajeDestino;
  movimientos: IMovimientoPeriodo[];
}

export interface IDashboardResumen {
  ahorroTotal: number;
  ahorrosLugares: IAhorroLugar[];
  deudaTarjetas: IDeudaTarjeta[];
  deudaTarjetasTotal: number;
  gastosPorCategoria: IGastoPorCategoria[];
  proximosMovimientos: IProximoMovimiento[];
  periodos: {
    mes: IResumenPeriodo;
    quincena1: IResumenPeriodo;
    quincena2: IResumenPeriodo;
  };
}
