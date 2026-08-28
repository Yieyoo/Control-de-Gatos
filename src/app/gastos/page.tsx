// src/app/gastos/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IGastoVariable, ICategoria, IAhorroLugar, IDepositoTercero, IFuenteDinero, ITarjetaCredito } from '@/types';
import { formatearMoneda, formatearDiaMes } from '@/utils/calculos';
import { SelectorDiasSemana } from '@/components/SelectorDiasSemana';
import { Receipt, Pencil, Trash2, Repeat, Undo2 } from 'lucide-react';

const ETIQUETA_FUENTE: Record<IFuenteDinero, string> = {
  disponible: 'Disponible',
  ahorro: 'Ahorro',
  tercero: 'Tercero',
};

export default function GastosPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <GastosContenido />
    </Suspense>
  );
}

function GastosContenido() {
  const searchParams = useSearchParams();
  const [gastos, setGastos] = useState<IGastoVariable[]>([]);
  const [categorias, setCategorias] = useState<ICategoria[]>([]);
  const [ahorroLugares, setAhorroLugares] = useState<IAhorroLugar[]>([]);
  const [depositosTerceros, setDepositosTerceros] = useState<IDepositoTercero[]>([]);
  const [tarjetas, setTarjetas] = useState<ITarjetaCredito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(() => searchParams.get('nuevo') === '1');

  const [formData, setFormData] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    notas: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
    fuente: 'disponible' as IFuenteDinero,
    ahorroLugarId: '',
    depositoTerceroId: '',
  });

  // "¿Es un gasto fijo?" -- si es "sí", en vez de registrar un gasto de una sola
  // vez (fuente disponible/ahorro/tercero), se crea una regla recurrente
  // (GastoDomiciliado) que luego aparece en el Dashboard para confirmar cada
  // vez que de verdad se cobre.
  const [esGastoFijo, setEsGastoFijo] = useState(false);
  const [diasSemanaFijo, setDiasSemanaFijo] = useState<number[]>([]);
  const [formFijo, setFormFijo] = useState({
    frecuencia: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    fechaCobro: '',
    cuentaPago: '',
    tarjetaId: '',
  });

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formEdicion, setFormEdicion] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    notas: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
  });

  const [formDevolucionAbierto, setFormDevolucionAbierto] = useState<number | null>(null);
  const [formDevolucion, setFormDevolucion] = useState({ cantidad: '', concepto: '' });

  useEffect(() => {
    Promise.all([cargarGastos(), cargarCategorias(), cargarAhorroLugares(), cargarDepositosTerceros(), cargarTarjetas()]);
  }, []);

  const cargarGastos = async () => {
    try {
      const resp = await fetch('/api/gastos/variables');
      if (!resp.ok) throw new Error('Error al cargar gastos');
      const datos = await resp.json();
      setGastos(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const cargarCategorias = async () => {
    try {
      const resp = await fetch('/api/categorias');
      if (!resp.ok) throw new Error('Error al cargar categorías');
      const datos = await resp.json();
      setCategorias(datos);
    } catch (err) {
      console.error(err);
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

  const cargarDepositosTerceros = async () => {
    try {
      const resp = await fetch('/api/terceros');
      if (resp.ok) setDepositosTerceros(await resp.json());
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esGastoFijo && formFijo.frecuencia === 'semanal' && diasSemanaFijo.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    try {
      const resp = esGastoFijo
        ? await fetch('/api/gastos/domiciliados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: formData.nombre,
              cantidad: formData.cantidad,
              categoriaId: formData.categoriaId,
              tipoPresupuesto: formData.tipoPresupuesto,
              notas: formData.notas,
              frecuencia: formFijo.frecuencia,
              fechaCobro: formFijo.frecuencia === 'semanal' ? undefined : formFijo.fechaCobro,
              diasSemana: formFijo.frecuencia === 'semanal' ? diasSemanaFijo.join(',') : undefined,
              cuentaPago: formFijo.cuentaPago,
              tarjetaId: formFijo.tarjetaId || undefined,
            }),
          })
        : await fetch('/api/gastos/variables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              cantidad: parseFloat(formData.cantidad),
              categoriaId: parseInt(formData.categoriaId),
              ahorroLugarId: formData.fuente === 'ahorro' ? formData.ahorroLugarId : undefined,
              depositoTerceroId: formData.fuente === 'tercero' ? formData.depositoTerceroId : undefined,
            }),
          });

      if (!resp.ok) {
        const datos = await resp.json().catch(() => null);
        throw new Error(datos?.error || 'Error al crear gasto');
      }
      setFormData({
        nombre: '',
        cantidad: '',
        categoriaId: '',
        notas: '',
        tipoPresupuesto: 'gusto',
        fuente: 'disponible',
        ahorroLugarId: '',
        depositoTerceroId: '',
      });
      setEsGastoFijo(false);
      setFormFijo({ frecuencia: 'mensual', fechaCobro: '', cuentaPago: '', tarjetaId: '' });
      setDiasSemanaFijo([]);
      setMostrarFormulario(false);
      cargarGastos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleCategoriaChange = (categoriaId: string) => {
    const categoria = categorias.find((c) => String(c.id) === categoriaId);
    setFormData({ ...formData, categoriaId, tipoPresupuesto: categoria?.tipoPresupuesto ?? 'gusto' });
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro?')) return;
    try {
      const resp = await fetch(`/api/gastos/variables/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarGastos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const iniciarEdicion = (gasto: IGastoVariable) => {
    setEditandoId(gasto.id);
    setFormEdicion({
      nombre: gasto.nombre,
      cantidad: String(gasto.cantidad),
      categoriaId: String(gasto.categoriaId),
      notas: gasto.notas || '',
      tipoPresupuesto: gasto.tipoPresupuesto ?? gasto.categoria?.tipoPresupuesto ?? 'gusto',
    });
  };

  const handleCategoriaEdicionChange = (categoriaId: string) => {
    const categoria = categorias.find((c) => String(c.id) === categoriaId);
    setFormEdicion({ ...formEdicion, categoriaId, tipoPresupuesto: categoria?.tipoPresupuesto ?? 'gusto' });
  };

  const handleGuardarEdicion = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    try {
      const resp = await fetch(`/api/gastos/variables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formEdicion,
          cantidad: parseFloat(formEdicion.cantidad),
          categoriaId: parseInt(formEdicion.categoriaId),
        }),
      });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => null);
        throw new Error(datos?.error || 'Error al actualizar gasto');
      }
      setEditandoId(null);
      cargarGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitDevolucion = async (e: React.FormEvent, gastoVariableId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formDevolucion, gastoVariableId }),
      });
      if (!resp.ok) throw new Error('Error al registrar devolución');
      setFormDevolucion({ cantidad: '', concepto: '' });
      setFormDevolucionAbierto(null);
      cargarGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const netoDe = (gasto: IGastoVariable) =>
    gasto.cantidad - (gasto.devoluciones ?? []).reduce((s, d) => s + d.cantidad, 0);

  if (cargando) return <div>Cargando...</div>;

  const total = gastos.reduce((sum, g) => sum + netoDe(g), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Receipt className="w-7 h-7" strokeWidth={1.75} /> Gastos Variables
        </h1>
        <p className="text-gray-600 mt-1">Registra tus gastos conforme ocurren</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Total de gastos este mes</p>
        <p className="text-3xl font-bold text-red-600">{formatearMoneda(total)}</p>
      </div>

      {/* Botón agregar */}
      {!mostrarFormulario && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar Gasto
        </button>
      )}

      {/* Formulario */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Concepto del gasto"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <input
            type="number"
            placeholder="Cantidad"
            value={formData.cantidad}
            onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
            required
            step="0.01"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <select
            value={formData.categoriaId}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>

          <div>
            <p className="text-sm text-gray-600 mb-1">¿Es un gasto fijo (se repite cada mes/quincena/semana)?</p>
            <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit">
              {([false, true] as const).map((valor) => (
                <button
                  key={String(valor)}
                  type="button"
                  onClick={() => setEsGastoFijo(valor)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    esGastoFijo === valor ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {valor ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {esGastoFijo ? (
            <div className="space-y-3 bg-gray-50 rounded-lg p-3">
              <select
                value={formFijo.frecuencia}
                onChange={(e) => setFormFijo({ ...formFijo, frecuencia: e.target.value as typeof formFijo.frecuencia })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal (elige los días)</option>
              </select>
              {formFijo.frecuencia === 'semanal' ? (
                <SelectorDiasSemana seleccionados={diasSemanaFijo} onChange={setDiasSemanaFijo} />
              ) : (
                <input
                  type="number"
                  placeholder="Día de cobro (1-31)"
                  value={formFijo.fechaCobro}
                  onChange={(e) => setFormFijo({ ...formFijo, fechaCobro: e.target.value })}
                  required
                  min={1}
                  max={31}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              )}
              <input
                type="text"
                placeholder="Cuenta de pago (ej: Tarjeta BBVA, Efectivo)"
                value={formFijo.cuentaPago}
                onChange={(e) => setFormFijo({ ...formFijo, cuentaPago: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              {tarjetas.length > 0 && (
                <select
                  value={formFijo.tarjetaId}
                  onChange={(e) => setFormFijo({ ...formFijo, tarjetaId: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">¿Se carga a una tarjeta de crédito? (opcional)</option>
                  {tarjetas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-gray-500">
                Va a aparecer como pendiente cada quincena hasta que marques la palomita de que ya se cobró.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-1">¿De dónde sale el dinero?</p>
              <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit flex-wrap">
                {(['disponible', 'ahorro', 'tercero'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormData({ ...formData, fuente: f })}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      formData.fuente === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {ETIQUETA_FUENTE[f]}
                  </button>
                ))}
              </div>
              {formData.fuente === 'ahorro' && (
                <select
                  value={formData.ahorroLugarId}
                  onChange={(e) => setFormData({ ...formData, ahorroLugarId: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 mt-2"
                >
                  <option value="">¿De qué cuenta de ahorro?</option>
                  {ahorroLugares.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({formatearMoneda(a.saldoActual)})</option>
                  ))}
                </select>
              )}
              {formData.fuente === 'tercero' && (
                <select
                  value={formData.depositoTerceroId}
                  onChange={(e) => setFormData({ ...formData, depositoTerceroId: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 mt-2"
                >
                  <option value="">¿Con qué depósito de tercero?</option>
                  {depositosTerceros
                    .filter((d) => d.pendiente > 0)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.persona} — {d.concepto} ({formatearMoneda(d.pendiente)} pendiente)
                      </option>
                    ))}
                </select>
              )}
              {formData.fuente === 'tercero' && depositosTerceros.filter((d) => d.pendiente > 0).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Primero registra un depósito en la sección Terceros.
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-sm text-gray-600 mb-1">¿A qué se destina?</p>
            <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit">
              {(['necesidad', 'gusto'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFormData({ ...formData, tipoPresupuesto: tipo })}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    formData.tipoPresupuesto === tipo ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}
                </button>
              ))}
            </div>
          </div>

          <textarea
            placeholder="Notas (opcional)"
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={2}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarFormulario(false);
                setEsGastoFijo(false);
                setDiasSemanaFijo([]);
              }}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {gastos.map((gasto) =>
          editandoId === gasto.id ? (
            <form
              key={gasto.id}
              onSubmit={(e) => handleGuardarEdicion(e, gasto.id)}
              className="bg-white border border-blue-300 rounded-lg p-4 space-y-3"
            >
              <input
                type="text"
                placeholder="Concepto del gasto"
                value={formEdicion.nombre}
                onChange={(e) => setFormEdicion({ ...formEdicion, nombre: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Cantidad"
                value={formEdicion.cantidad}
                onChange={(e) => setFormEdicion({ ...formEdicion, cantidad: e.target.value })}
                required
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <select
                value={formEdicion.categoriaId}
                onChange={(e) => handleCategoriaEdicionChange(e.target.value)}
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
                      onClick={() => setFormEdicion({ ...formEdicion, tipoPresupuesto: tipo })}
                      className={`px-3 py-1.5 rounded-md transition-colors ${
                        formEdicion.tipoPresupuesto === tipo ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="Notas (opcional)"
                value={formEdicion.notas}
                onChange={(e) => setFormEdicion({ ...formEdicion, notas: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={2}
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoId(null)}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div
              key={gasto.id}
              className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
            >
              <div className="flex justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{gasto.nombre}</p>
                  <p className="text-sm text-gray-600 truncate">
                    {gasto.categoria?.nombre}
                    {gasto.notas && ` • ${gasto.notas}`}
                    {' • '}
                    {ETIQUETA_FUENTE[gasto.fuente]}
                    {gasto.gastoDomiciliadoOrigenId != null && (
                      <span className="inline-flex items-center gap-0.5">
                        {' • '}
                        <Repeat className="w-3 h-3" strokeWidth={1.75} /> automático
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600 whitespace-nowrap">{formatearMoneda(netoDe(gasto))}</p>
                    {(gasto.devoluciones?.length ?? 0) > 0 && (
                      <p className="text-xs text-gray-400 whitespace-nowrap line-through">{formatearMoneda(gasto.cantidad)}</p>
                    )}
                  </div>
                  <button onClick={() => iniciarEdicion(gasto)} className="text-blue-600 hover:text-blue-800">
                    <Pencil className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button onClick={() => handleEliminar(gasto.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {(gasto.devoluciones?.length ?? 0) > 0 && (
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {gasto.devoluciones!.map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1">
                      <Undo2 className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                      Devolución {formatearMoneda(d.cantidad)} · {formatearDiaMes(new Date(d.fecha))}
                      {d.concepto && ` · ${d.concepto}`}
                    </li>
                  ))}
                </ul>
              )}

              {formDevolucionAbierto === gasto.id ? (
                <form
                  onSubmit={(e) => handleSubmitDevolucion(e, gasto.id)}
                  className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2"
                >
                  <input
                    type="number"
                    placeholder="Cantidad devuelta"
                    value={formDevolucion.cantidad}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, cantidad: e.target.value })}
                    required
                    step="0.01"
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                  />
                  <input
                    type="text"
                    placeholder="Concepto (opcional)"
                    value={formDevolucion.concepto}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, concepto: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[8rem]"
                  />
                  <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDevolucionAbierto(null)}
                    className="bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setFormDevolucionAbierto(gasto.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Registrar devolución
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
