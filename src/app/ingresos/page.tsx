// src/app/ingresos/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { IIngreso } from '@/types';
import { formatearMoneda } from '@/utils/calculos';

export default function IngresosPage() {
  const [ingresos, setIngresos] = useState<IIngreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    cantidad: '',
    frecuencia: 'mensual' as const,
    notas: '',
  });

  useEffect(() => {
    cargarIngresos();
  }, []);

  const cargarIngresos = async () => {
    try {
      const resp = await fetch('/api/ingresos');
      if (!resp.ok) throw new Error('Error al cargar ingresos');
      const datos = await resp.json();
      setIngresos(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cantidad: parseFloat(formData.cantidad),
        }),
      });

      if (!resp.ok) throw new Error('Error al crear ingreso');
      setFormData({ nombre: '', cantidad: '', frecuencia: 'mensual', notas: '' });
      setMostrarFormulario(false);
      cargarIngresos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro?')) return;
    try {
      const resp = await fetch(`/api/ingresos/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarIngresos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const total = ingresos.reduce((sum, ing) => sum + ing.cantidad, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📈 Ingresos</h1>
        <p className="text-gray-600 mt-1">Administra tus ingresos personales</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Total de ingresos registrados</p>
        <p className="text-3xl font-bold text-green-600">{formatearMoneda(total)}</p>
      </div>

      {/* Botón agregar */}
      {!mostrarFormulario && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar Ingreso
        </button>
      )}

      {/* Formulario */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre del ingreso"
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
            value={formData.frecuencia}
            onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value as any })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="mensual">Mensual</option>
            <option value="quincenal">Quincenal</option>
            <option value="unico">Único</option>
          </select>

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
        {ingresos.map((ingreso) => (
          <div
            key={ingreso.id}
            className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{ingreso.nombre}</p>
              <p className="text-sm text-gray-600 truncate">
                {ingreso.frecuencia.charAt(0).toUpperCase() + ingreso.frecuencia.slice(1)}
                {ingreso.notas && ` • ${ingreso.notas}`}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <p className="text-lg font-bold text-green-600 whitespace-nowrap">{formatearMoneda(ingreso.cantidad)}</p>
              <button
                onClick={() => handleEliminar(ingreso.id)}
                className="text-red-600 hover:text-red-800"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
