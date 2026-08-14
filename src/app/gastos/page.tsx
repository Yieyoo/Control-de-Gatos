// src/app/gastos/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IGastoVariable, ICategoria } from '@/types';
import { formatearMoneda } from '@/utils/calculos';

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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(() => searchParams.get('nuevo') === '1');
  
  const [formData, setFormData] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    notas: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
  });

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formEdicion, setFormEdicion] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    notas: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
  });

  useEffect(() => {
    Promise.all([cargarGastos(), cargarCategorias()]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/gastos/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cantidad: parseFloat(formData.cantidad),
          categoriaId: parseInt(formData.categoriaId),
        }),
      });

      if (!resp.ok) throw new Error('Error al crear gasto');
      setFormData({ nombre: '', cantidad: '', categoriaId: '', notas: '', tipoPresupuesto: 'gusto' });
      setMostrarFormulario(false);
      cargarGastos();
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
      if (!resp.ok) throw new Error('Error al actualizar gasto');
      setEditandoId(null);
      cargarGastos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const total = gastos.reduce((sum, g) => sum + g.cantidad, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💸 Gastos Variables</h1>
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
              onClick={() => setMostrarFormulario(false)}
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
              className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{gasto.nombre}</p>
                <p className="text-sm text-gray-600 truncate">
                  {gasto.categoria?.nombre}
                  {gasto.notas && ` • ${gasto.notas}`}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                <p className="text-lg font-bold text-red-600 whitespace-nowrap">{formatearMoneda(gasto.cantidad)}</p>
                <button
                  onClick={() => iniciarEdicion(gasto)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleEliminar(gasto.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
