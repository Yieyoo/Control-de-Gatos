// src/app/movimientos/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { IGastoDomiciliado, IAhorroDomiciliado, ICategoria, IAhorroLugar, ITarjetaCredito } from '@/types';
import { formatearMoneda } from '@/utils/calculos';

const etiquetaFrecuencia: Record<string, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal',
  semanal: 'Semanal',
};

const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const OPCIONES_DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 0, etiqueta: 'Dom' },
];

function formatearDiasSemana(diasSemana?: string): string {
  if (!diasSemana) return '';
  return diasSemana
    .split(',')
    .map((d) => NOMBRES_DIAS[parseInt(d, 10)])
    .join(', ');
}

function SelectorDiasSemana({
  seleccionados,
  onChange,
}: {
  seleccionados: number[];
  onChange: (dias: number[]) => void;
}) {
  const alternar = (dia: number) => {
    onChange(seleccionados.includes(dia) ? seleccionados.filter((d) => d !== dia) : [...seleccionados, dia]);
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-1">¿Qué días de la semana?</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES_DIAS_SEMANA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => alternar(opcion.valor)}
            className={`px-2.5 py-1.5 rounded text-sm font-medium border ${
              seleccionados.includes(opcion.valor)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MovimientosPage() {
  const [error, setError] = useState<string | null>(null);

  // Gastos domiciliados
  const [gastos, setGastos] = useState<IGastoDomiciliado[]>([]);
  const [categorias, setCategorias] = useState<ICategoria[]>([]);
  const [tarjetas, setTarjetas] = useState<ITarjetaCredito[]>([]);
  const [cargandoGastos, setCargandoGastos] = useState(true);
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [diasSemanaGasto, setDiasSemanaGasto] = useState<number[]>([]);
  const [formGasto, setFormGasto] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    fechaCobro: '',
    frecuencia: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    cuentaPago: '',
    tarjetaId: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
  });

  // Ahorros domiciliados
  const [ahorrosDom, setAhorrosDom] = useState<IAhorroDomiciliado[]>([]);
  const [ahorroLugares, setAhorroLugares] = useState<IAhorroLugar[]>([]);
  const [cargandoAhorros, setCargandoAhorros] = useState(true);
  const [mostrarFormAhorro, setMostrarFormAhorro] = useState(false);
  const [diasSemanaAhorro, setDiasSemanaAhorro] = useState<number[]>([]);
  const [formAhorro, setFormAhorro] = useState({
    nombre: '',
    cantidad: '',
    frecuencia: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    ahorroDestinoId: '',
  });

  useEffect(() => {
    cargarGastos();
    cargarCategorias();
    cargarTarjetas();
    cargarAhorrosDom();
    cargarAhorroLugares();
  }, []);

  const cargarGastos = async () => {
    try {
      const resp = await fetch('/api/gastos/domiciliados');
      if (!resp.ok) throw new Error('Error al cargar gastos domiciliados');
      setGastos(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargandoGastos(false);
    }
  };

  const cargarCategorias = async () => {
    try {
      const resp = await fetch('/api/categorias');
      if (resp.ok) setCategorias(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarTarjetas = async () => {
    try {
      const resp = await fetch('/api/tarjetas');
      if (resp.ok) setTarjetas(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarAhorrosDom = async () => {
    try {
      const resp = await fetch('/api/ahorros/domiciliados');
      if (!resp.ok) throw new Error('Error al cargar ahorros domiciliados');
      setAhorrosDom(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargandoAhorros(false);
    }
  };

  const cargarAhorroLugares = async () => {
    try {
      const resp = await fetch('/api/ahorros');
      if (resp.ok) setAhorroLugares(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formGasto.frecuencia === 'semanal' && diasSemanaGasto.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    try {
      const resp = await fetch('/api/gastos/domiciliados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formGasto,
          diasSemana: formGasto.frecuencia === 'semanal' ? diasSemanaGasto.join(',') : undefined,
        }),
      });
      if (!resp.ok) throw new Error('Error al crear gasto domiciliado');
      setFormGasto({
        nombre: '',
        cantidad: '',
        categoriaId: '',
        fechaCobro: '',
        frecuencia: 'mensual',
        cuentaPago: '',
        tarjetaId: '',
        tipoPresupuesto: 'gusto',
      });
      setDiasSemanaGasto([]);
      setMostrarFormGasto(false);
      cargarGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleCategoriaGastoChange = (categoriaId: string) => {
    const categoria = categorias.find((c) => String(c.id) === categoriaId);
    setFormGasto({ ...formGasto, categoriaId, tipoPresupuesto: categoria?.tipoPresupuesto ?? 'gusto' });
  };

  const handleEliminarGasto = async (id: number) => {
    if (!confirm('¿Estás seguro?')) return;
    try {
      const resp = await fetch(`/api/gastos/domiciliados/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitAhorro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formAhorro.frecuencia === 'semanal' && diasSemanaAhorro.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    try {
      const resp = await fetch('/api/ahorros/domiciliados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formAhorro,
          diasSemana: formAhorro.frecuencia === 'semanal' ? diasSemanaAhorro.join(',') : undefined,
        }),
      });
      if (!resp.ok) throw new Error('Error al crear ahorro domiciliado');
      setFormAhorro({ nombre: '', cantidad: '', frecuencia: 'mensual', ahorroDestinoId: '' });
      setDiasSemanaAhorro([]);
      setMostrarFormAhorro(false);
      cargarAhorrosDom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarAhorro = async (id: number) => {
    if (!confirm('¿Estás seguro?')) return;
    try {
      const resp = await fetch(`/api/ahorros/domiciliados/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarAhorrosDom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⏰ Movimientos Programados</h1>
        <p className="text-gray-600 mt-1">Gestiona tus gastos y ahorros automáticos</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gastos Domiciliados */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold">💳 Gastos Domiciliados</h2>

          {!mostrarFormGasto && (
            <button
              onClick={() => setMostrarFormGasto(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Agregar
            </button>
          )}

          {mostrarFormGasto && (
            <form onSubmit={handleSubmitGasto} className="space-y-3 bg-gray-50 rounded-lg p-4">
              <input
                type="text"
                placeholder="Nombre (ej: Netflix, Estacionamiento)"
                value={formGasto.nombre}
                onChange={(e) => setFormGasto({ ...formGasto, nombre: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Cantidad"
                value={formGasto.cantidad}
                onChange={(e) => setFormGasto({ ...formGasto, cantidad: e.target.value })}
                required
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <select
                value={formGasto.categoriaId}
                onChange={(e) => handleCategoriaGastoChange(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              <div>
                <p className="text-sm text-gray-600 mb-1">¿A qué se destina?</p>
                <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit">
                  {(['necesidad', 'gusto'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFormGasto({ ...formGasto, tipoPresupuesto: tipo })}
                      className={`px-3 py-1.5 rounded-md transition-colors ${
                        formGasto.tipoPresupuesto === tipo ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}
                    </button>
                  ))}
                </div>
              </div>
              <select
                value={formGasto.frecuencia}
                onChange={(e) => setFormGasto({ ...formGasto, frecuencia: e.target.value as typeof formGasto.frecuencia })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal (elige los días)</option>
              </select>
              {formGasto.frecuencia === 'semanal' ? (
                <SelectorDiasSemana seleccionados={diasSemanaGasto} onChange={setDiasSemanaGasto} />
              ) : (
                <input
                  type="number"
                  placeholder="Día de cobro (1-31)"
                  value={formGasto.fechaCobro}
                  onChange={(e) => setFormGasto({ ...formGasto, fechaCobro: e.target.value })}
                  required
                  min={1}
                  max={31}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              )}
              <input
                type="text"
                placeholder="Cuenta de pago (ej: Tarjeta BBVA, Efectivo)"
                value={formGasto.cuentaPago}
                onChange={(e) => setFormGasto({ ...formGasto, cuentaPago: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              {tarjetas.length > 0 && (
                <select
                  value={formGasto.tarjetaId}
                  onChange={(e) => setFormGasto({ ...formGasto, tarjetaId: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">¿Se carga a una tarjeta de crédito? (opcional)</option>
                  {tarjetas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormGasto(false);
                    setDiasSemanaGasto([]);
                  }}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {cargandoGastos ? (
            <p className="text-gray-500 text-sm">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-gray-500 text-sm">No tienes gastos domiciliados.</p>
          ) : (
            <div className="space-y-2">
              {gastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{g.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {g.categoria?.nombre} •{' '}
                      {g.frecuencia === 'semanal'
                        ? formatearDiasSemana(g.diasSemana)
                        : `Día ${g.fechaCobro} • ${etiquetaFrecuencia[g.frecuencia]}`}
                      {g.tarjeta && ` • 💳 ${g.tarjeta.nombre}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-bold text-red-600 whitespace-nowrap">{formatearMoneda(g.cantidad)}</p>
                    <button onClick={() => handleEliminarGasto(g.id)} className="text-red-600 hover:text-red-800">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ahorros Domiciliados */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold">💰 Ahorros Domiciliados</h2>

          {ahorroLugares.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800 text-sm">
              Primero crea un lugar de ahorro en la sección Ahorros.
            </div>
          ) : (
            <>
              {!mostrarFormAhorro && (
                <button
                  onClick={() => setMostrarFormAhorro(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  + Agregar
                </button>
              )}

              {mostrarFormAhorro && (
                <form onSubmit={handleSubmitAhorro} className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <input
                    type="text"
                    placeholder="Nombre (ej: Ahorro automático)"
                    value={formAhorro.nombre}
                    onChange={(e) => setFormAhorro({ ...formAhorro, nombre: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={formAhorro.cantidad}
                    onChange={(e) => setFormAhorro({ ...formAhorro, cantidad: e.target.value })}
                    required
                    step="0.01"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <select
                    value={formAhorro.frecuencia}
                    onChange={(e) => setFormAhorro({ ...formAhorro, frecuencia: e.target.value as typeof formAhorro.frecuencia })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal (elige los días)</option>
                  </select>
                  {formAhorro.frecuencia === 'semanal' && (
                    <SelectorDiasSemana seleccionados={diasSemanaAhorro} onChange={setDiasSemanaAhorro} />
                  )}
                  <select
                    value={formAhorro.ahorroDestinoId}
                    onChange={(e) => setFormAhorro({ ...formAhorro, ahorroDestinoId: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">¿A qué cuenta de ahorro?</option>
                    {ahorroLugares.map((lugar) => (
                      <option key={lugar.id} value={lugar.id}>{lugar.nombre}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormAhorro(false);
                        setDiasSemanaAhorro([]);
                      }}
                      className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {cargandoAhorros ? (
            <p className="text-gray-500 text-sm">Cargando...</p>
          ) : ahorrosDom.length === 0 ? (
            <p className="text-gray-500 text-sm">No tienes ahorros domiciliados.</p>
          ) : (
            <div className="space-y-2">
              {ahorrosDom.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{a.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">
                      → {a.ahorroDestino?.nombre} •{' '}
                      {a.frecuencia === 'semanal' ? formatearDiasSemana(a.diasSemana) : etiquetaFrecuencia[a.frecuencia]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-bold text-blue-600 whitespace-nowrap">{formatearMoneda(a.cantidad)}</p>
                    <button onClick={() => handleEliminarAhorro(a.id)} className="text-red-600 hover:text-red-800">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
