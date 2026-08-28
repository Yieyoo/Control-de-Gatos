// src/app/terceros/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IDepositoTercero } from '@/types';
import { formatearMoneda, formatearDiaMes } from '@/utils/calculos';
import { Handshake, Trash2 } from 'lucide-react';

const ETIQUETA_ESTADO: Record<IDepositoTercero['estado'], { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-800' },
  parcial: { texto: 'Parcialmente usado', clase: 'bg-blue-100 text-blue-800' },
  utilizado: { texto: 'Utilizado', clase: 'bg-gray-200 text-gray-600' },
};

export default function TercerosPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <TercerosContenido />
    </Suspense>
  );
}

function TercerosContenido() {
  const searchParams = useSearchParams();
  const [depositos, setDepositos] = useState<IDepositoTercero[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(() => searchParams.get('nuevo') === '1');

  const [formData, setFormData] = useState({
    persona: '',
    cantidad: '',
    concepto: '',
    pagoRelacionado: '',
    notas: '',
  });

  useEffect(() => {
    cargarDepositos();
  }, []);

  const cargarDepositos = async () => {
    try {
      const resp = await fetch('/api/terceros');
      if (!resp.ok) throw new Error('Error al cargar depósitos');
      setDepositos(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/terceros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, cantidad: parseFloat(formData.cantidad) }),
      });
      if (!resp.ok) throw new Error('Error al crear depósito');
      setFormData({ persona: '', cantidad: '', concepto: '', pagoRelacionado: '', notas: '' });
      setMostrarFormulario(false);
      cargarDepositos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este depósito?')) return;
    try {
      const resp = await fetch(`/api/terceros/${id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => null);
        throw new Error(datos?.error || 'Error al eliminar');
      }
      cargarDepositos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const totalPendiente = depositos.reduce((sum, d) => sum + d.pendiente, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Handshake className="w-7 h-7" strokeWidth={1.75} /> Dinero de Terceros
        </h1>
        <p className="text-gray-600 mt-1">Dinero que alguien más te depositó para pagar algo específico</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Pendiente de usar</p>
        <p className="text-3xl font-bold text-amber-600">{formatearMoneda(totalPendiente)}</p>
        <p className="text-xs text-gray-500 mt-1">Este dinero no es tuyo -- no cuenta en tus estadísticas de gasto.</p>
      </div>

      {!mostrarFormulario && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Registrar depósito
        </button>
      )}

      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="¿Quién te depositó? (ej: Mi amigo Juan)"
            value={formData.persona}
            onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
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
          <input
            type="text"
            placeholder="Concepto (ej: Reservación del hotel)"
            value={formData.concepto}
            onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="¿A qué pago corresponde? (opcional)"
            value={formData.pagoRelacionado}
            onChange={(e) => setFormData({ ...formData, pagoRelacionado: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <textarea
            placeholder="Notas (opcional)"
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={2}
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
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

      <div className="space-y-2">
        {depositos.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">No tienes depósitos de terceros registrados.</p>
          </div>
        ) : (
          depositos.map((d) => {
            const estado = ETIQUETA_ESTADO[d.estado];
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{d.persona}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.clase}`}>{estado.texto}</span>
                    </div>
                    <p className="text-sm text-gray-600">{d.concepto}</p>
                    {d.pagoRelacionado && <p className="text-xs text-gray-500">Para: {d.pagoRelacionado}</p>}
                    <p className="text-xs text-gray-400 mt-1">{formatearDiaMes(new Date(d.fecha))}</p>
                    {(d.usos?.length ?? 0) > 0 && (
                      <ul className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                        {d.usos!.map((u, i) => (
                          <li key={i}>
                            ↳ {u.nombre} · {formatearMoneda(u.cantidad)} · {formatearDiaMes(new Date(u.fecha))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">{formatearMoneda(d.cantidad)}</p>
                    <p className="text-xs text-gray-500">Usado: {formatearMoneda(d.montoUtilizado)}</p>
                    <p className="text-xs font-semibold text-amber-600">Pendiente: {formatearMoneda(d.pendiente)}</p>
                    <button onClick={() => handleEliminar(d.id)} className="text-red-600 hover:text-red-800 text-sm mt-1 inline-flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
