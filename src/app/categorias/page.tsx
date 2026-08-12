// src/app/categorias/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { ICategoria } from '@/types';

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<ICategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    color: '#3b82f6',
    icono: '',
  });

  useEffect(() => {
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    try {
      const resp = await fetch('/api/categorias');
      if (!resp.ok) throw new Error('Error al cargar categorías');
      const datos = await resp.json();
      setCategorias(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!resp.ok) throw new Error('Error al crear categoría');
      setFormData({ nombre: '', color: '#3b82f6', icono: '' });
      setMostrarFormulario(false);
      cargarCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const sistematicas = categorias.filter((c) => c.esDelSistema);
  const personalizadas = categorias.filter((c) => !c.esDelSistema);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏷️ Categorías</h1>
        <p className="text-gray-600 mt-1">Organiza tus gastos por categoría</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Botón agregar */}
      {!mostrarFormulario && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Crear Categoría Personalizada
        </button>
      )}

      {/* Formulario */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre de la categoría"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          
          <div className="flex gap-4 items-center">
            <label className="text-sm font-medium">Color:</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
            />
          </div>

          <input
            type="text"
            placeholder="Icono (emoji, ej: 🎬)"
            value={formData.icono}
            onChange={(e) => setFormData({ ...formData, icono: e.target.value })}
            maxLength={2}
            className="w-full border border-gray-300 rounded px-3 py-2"
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

      {/* Categorías del Sistema */}
      {sistematicas.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-3">📌 Categorías Predeterminadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sistematicas.map((cat) => (
              <div
                key={cat.id}
                className="rounded-lg p-4 border-2"
                style={{ borderColor: cat.color, backgroundColor: cat.color + '10' }}
              >
                <p className="font-semibold">{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorías Personalizadas */}
      {personalizadas.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-3">✨ Tus Categorías</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalizadas.map((cat) => (
              <div
                key={cat.id}
                className="rounded-lg p-4 border-2"
                style={{ borderColor: cat.color, backgroundColor: cat.color + '10' }}
              >
                <p className="font-semibold">{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
