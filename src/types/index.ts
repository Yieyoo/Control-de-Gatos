// src/types/index.ts

export interface ICategoria {
  id: number;
  nombre: string;
  color: string;
  icono?: string;
  esDelSistema: boolean;
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
  fechaCobro: number;
  frecuencia: 'mensual' | 'quincenal';
  categoriaId: number;
  cuentaPago: string;
  activo: boolean;
  notas?: string;
}

export interface IAhorroDomiciliado {
  id: number;
  nombre: string;
  cantidad: number;
  frecuencia: 'mensual' | 'quincenal' | 'semanal';
  ahorroDestinoId: number;
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

export interface IDashboardResumen {
  ingresosTotales: number;
  gastosFijos: number;
  gastosVariables: number;
  ahorroTotal: number;
  ahorroDelMes: number;
  dineroDisponible: number;
  gastosPorCategoria: IGastoPorCategoria[];
  proximosMovimientos: IProximoMovimiento[];
}
