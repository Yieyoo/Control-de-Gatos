// src/app/ingresos/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IIngreso } from '@/types';
import { formatearMoneda, formatearDiaMes, hoyMexico } from '@/utils/calculos';
import { TrendingUp, Trash2, Gift } from 'lucide-react';

export default function IngresosPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <IngresosContenido />
    </Suspense>
  );
}

/** Fecha de hoy (del navegador) como YYYY-MM-DD, para el valor por defecto del input date. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Formulario = 'sueldo' | 'extra' | null;

function IngresosContenido() {
  const searchParams = useSearchParams();
  const [ingresos, setIngresos] = useState<IIngreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(() => {
    const nuevo = searchParams.get('nuevo');
    if (nuevo === 'extra') return 'extra';
    if (nuevo === '1') return 'sueldo';
    return null;
  });

  const [formSueldo, setFormSueldo] = useState({
    nombre: '',
    cantidad: '',
    frecuencia: 'quincenal' as 'mensual' | 'quincenal',
    notas: '',
  });

  const [formExtra, setFormExtra] = useState({
    nombre: '',
    cantidad: '',
    fecha: hoyISO(),
    notas: '',
  });

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

  useEffect(() => {
    cargarIngresos();
  }, []);

  const crearIngreso = async (datos: Record<string, unknown>) => {
    const resp = await fetch('/api/ingresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (!resp.ok) throw new Error('Error al guardar');
  };

  const handleSubmitSueldo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crearIngreso({ ...formSueldo, cantidad: parseFloat(formSueldo.cantidad) });
      setFormSueldo({ nombre: '', cantidad: '', frecuencia: 'quincenal', notas: '' });
      setFormulario(null);
      cargarIngresos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crearIngreso({
        ...formExtra,
        cantidad: parseFloat(formExtra.cantidad),
        frecuencia: 'unico',
      });
      setFormExtra({ nombre: '', cantidad: '', fecha: hoyISO(), notas: '' });
      setFormulario(null);
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

  const sueldos = ingresos.filter((i) => i.frecuencia !== 'unico');
  const extras = ingresos
    .filter((i) => i.frecuencia === 'unico')
    .sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());

  const sueldoMensual = sueldos.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    if (ing.frecuencia === 'quincenal') return sum + ing.cantidad * 2;
    return sum + ing.cantidad;
  }, 0);

  const hoy = hoyMexico();
  const extraEsteMes = extras.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    const f = new Date(ing.fechaInicio);
    return f.getUTCMonth() === hoy.getUTCMonth() && f.getUTCFullYear() === hoy.getUTCFullYear() ? sum + ing.cantidad : sum;
  }, 0);
  const extraEsteAño = extras.reduce((sum, ing) => {
    if (!ing.activo) return sum;
    return new Date(ing.fechaInicio).getUTCFullYear() === hoy.getUTCFullYear() ? sum + ing.cantidad : sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="w-7 h-7" strokeWidth={1.75} /> Ingresos
        </h1>
        <p className="text-gray-600 mt-1">Tu sueldo y el dinero extra que te llega</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-gray-600">Sueldo al mes</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{formatearMoneda(sueldoMensual)}</p>
        </div>
        <div>
          <p className="text-gray-600">Dinero extra este mes</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{formatearMoneda(extraEsteMes)}</p>
        </div>
        <div>
          <p className="text-gray-600">Dinero extra en {hoy.getFullYear()}</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{formatearMoneda(extraEsteAño)}</p>
        </div>
      </div>

      {/* ───────── Sueldo ───────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" strokeWidth={1.75} /> Sueldo
          </h2>
          {formulario !== 'sueldo' && (
            <button
              onClick={() => setFormulario('sueldo')}
              className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm"
            >
              + Agregar sueldo
            </button>
          )}
        </div>

        {formulario === 'sueldo' && (
          <form onSubmit={handleSubmitSueldo} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <input
              type="text"
              placeholder="Nombre (ej. Sueldo trabajo)"
              value={formSueldo.nombre}
              onChange={(e) => setFormSueldo({ ...formSueldo, nombre: e.target.value })}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Cantidad"
              value={formSueldo.cantidad}
              onChange={(e) => setFormSueldo({ ...formSueldo, cantidad: e.target.value })}
              required
              step="0.01"
              min="0.01"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <select
              value={formSueldo.frecuencia}
              onChange={(e) => setFormSueldo({ ...formSueldo, frecuencia: e.target.value as 'mensual' | 'quincenal' })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
            <textarea
              placeholder="Notas (opcional)"
              value={formSueldo.notas}
              onChange={(e) => setFormSueldo({ ...formSueldo, notas: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={2}
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setFormulario(null)}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {sueldos.length === 0 && formulario !== 'sueldo' && (
          <p className="text-sm text-gray-500">Todavía no registras tu sueldo.</p>
        )}

        <div className="space-y-2">
          {sueldos.map((ingreso) => (
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
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600 whitespace-nowrap">{formatearMoneda(ingreso.cantidad)}</p>
                  {ingreso.frecuencia === 'quincenal' && (
                    <p className="text-xs text-gray-500 whitespace-nowrap">
                      {formatearMoneda(ingreso.cantidad * 2)} al mes
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleEliminar(ingreso.id)}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Eliminar ${ingreso.nombre}`}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Dinero extra ───────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5" strokeWidth={1.75} /> Dinero extra
            </h2>
            <p className="text-sm text-gray-500">Aguinaldo, algo que vendiste, un bono... se suma una sola vez.</p>
          </div>
          {formulario !== 'extra' && (
            <button
              onClick={() => setFormulario('extra')}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 text-sm flex-shrink-0"
            >
              + Agregar extra
            </button>
          )}
        </div>

        {formulario === 'extra' && (
          <form onSubmit={handleSubmitExtra} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <input
              type="text"
              placeholder="¿De dónde salió? (ej. Aguinaldo, Vendí la bici)"
              value={formExtra.nombre}
              onChange={(e) => setFormExtra({ ...formExtra, nombre: e.target.value })}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Cantidad"
              value={formExtra.cantidad}
              onChange={(e) => setFormExtra({ ...formExtra, cantidad: e.target.value })}
              required
              step="0.01"
              min="0.01"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <label className="block">
              <span className="text-sm text-gray-600">¿Cuándo te llegó?</span>
              <input
                type="date"
                value={formExtra.fecha}
                max={hoyISO()}
                onChange={(e) => setFormExtra({ ...formExtra, fecha: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
              />
            </label>
            <textarea
              placeholder="Notas (opcional)"
              value={formExtra.notas}
              onChange={(e) => setFormExtra({ ...formExtra, notas: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={2}
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setFormulario(null)}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {extras.length === 0 && formulario !== 'extra' && (
          <p className="text-sm text-gray-500">Aún no hay dinero extra registrado.</p>
        )}

        <div className="space-y-2">
          {extras.map((ingreso) => (
            <div
              key={ingreso.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{ingreso.nombre}</p>
                <p className="text-sm text-gray-600 truncate">
                  {formatearDiaMes(new Date(ingreso.fechaInicio))} {new Date(ingreso.fechaInicio).getUTCFullYear()}
                  {ingreso.notas && ` • ${ingreso.notas}`}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                <p className="text-lg font-bold text-emerald-600 whitespace-nowrap">+{formatearMoneda(ingreso.cantidad)}</p>
                <button
                  onClick={() => handleEliminar(ingreso.id)}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Eliminar ${ingreso.nombre}`}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
