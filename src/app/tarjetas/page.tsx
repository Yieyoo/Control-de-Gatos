// src/app/tarjetas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { ITarjetaCredito, ICompraTarjeta, ICategoria } from '@/types';
import { formatearMoneda, formatearDiaMes, hoyMexico, cicloTarjetaActual, cicloTarjetaAnterior } from '@/utils/calculos';

export default function TarjetasPage() {
  const [tarjetas, setTarjetas] = useState<ITarjetaCredito[]>([]);
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);
  const [categorias, setCategorias] = useState<ICategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarFormTarjeta, setMostrarFormTarjeta] = useState(false);
  const [formTarjeta, setFormTarjeta] = useState({ nombre: '', diaCorte: '', pagoQuincenal: '' });

  const [formCompraAbierto, setFormCompraAbierto] = useState<number | null>(null);
  const [formCompra, setFormCompra] = useState({ nombre: '', cantidad: '', categoriaId: '' });

  useEffect(() => {
    cargarTarjetas();
    cargarCompras();
    cargarCategorias();
  }, []);

  const cargarTarjetas = async () => {
    try {
      const resp = await fetch('/api/tarjetas');
      if (!resp.ok) throw new Error('Error al cargar tarjetas');
      setTarjetas(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const cargarCompras = async () => {
    try {
      const resp = await fetch('/api/tarjetas/compras');
      if (resp.ok) setCompras(await resp.json());
    } catch (err) {
      console.error(err);
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

  const handleSubmitTarjeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formTarjeta),
      });
      if (!resp.ok) throw new Error('Error al crear tarjeta');
      setFormTarjeta({ nombre: '', diaCorte: '', pagoQuincenal: '' });
      setMostrarFormTarjeta(false);
      cargarTarjetas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarTarjeta = async (id: number) => {
    if (!confirm('¿Eliminar esta tarjeta y todas sus compras?')) return;
    try {
      const resp = await fetch(`/api/tarjetas/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarTarjetas();
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitCompra = async (e: React.FormEvent, tarjetaId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formCompra, tarjetaId }),
      });
      if (!resp.ok) throw new Error('Error al registrar compra');
      setFormCompra({ nombre: '', cantidad: '', categoriaId: '' });
      setFormCompraAbierto(null);
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarCompra = async (id: number) => {
    if (!confirm('¿Eliminar esta compra?')) return;
    try {
      const resp = await fetch(`/api/tarjetas/compras/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const hoy = hoyMexico();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💳 Tarjeta de Crédito</h1>
        <p className="text-gray-600 mt-1">Tus compras y el corte de cada tarjeta</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
      )}

      {tarjetas.map((tarjeta) => {
        const cicloActual = cicloTarjetaActual(hoy, tarjeta.diaCorte);
        const cicloAnterior = cicloTarjetaAnterior(cicloActual, tarjeta.diaCorte);

        const enCiclo = (c: ICompraTarjeta, rango: { inicio: Date; fin: Date }) => {
          const f = new Date(c.fecha);
          return c.tarjetaId === tarjeta.id && f >= rango.inicio && f <= rango.fin;
        };

        const comprasActual = compras.filter((c) => enCiclo(c, cicloActual));
        const comprasAnterior = compras.filter((c) => enCiclo(c, cicloAnterior));
        const totalActual = comprasActual.reduce((s, c) => s + c.cantidad, 0);
        const totalAnterior = comprasAnterior.reduce((s, c) => s + c.cantidad, 0);

        return (
          <div key={tarjeta.id} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{tarjeta.nombre}</h2>
                <p className="text-xs text-gray-500">Corta el día {tarjeta.diaCorte} de cada mes</p>
              </div>
              <button onClick={() => handleEliminarTarjeta(tarjeta.id)} className="text-red-600 hover:text-red-800">
                🗑️
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="text-xs font-medium text-orange-800">
                  Corte anterior ({formatearDiaMes(cicloAnterior.inicio)} - {formatearDiaMes(cicloAnterior.fin)})
                </p>
                <p className="text-xl font-bold text-orange-700 mt-1">{formatearMoneda(totalAnterior)}</p>
                <p className="text-xs text-orange-700/70 mt-0.5">Ya cerró — esto es lo que debes pagar</p>
                {tarjeta.pagoQuincenal != null && (
                  <p className="text-xs text-orange-700/70">
                    Planeas pagar {formatearMoneda(tarjeta.pagoQuincenal)}/quincena
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-800">
                  Periodo actual ({formatearDiaMes(cicloActual.inicio)} - {formatearDiaMes(cicloActual.fin)})
                </p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatearMoneda(totalActual)}</p>
                <p className="text-xs text-blue-700/70 mt-0.5">Se sigue acumulando</p>
              </div>
            </div>

            {formCompraAbierto !== tarjeta.id ? (
              <button
                onClick={() => setFormCompraAbierto(tarjeta.id)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Agregar compra
              </button>
            ) : (
              <form
                onSubmit={(e) => handleSubmitCompra(e, tarjeta.id)}
                className="space-y-3 bg-gray-50 rounded-lg p-4"
              >
                <input
                  type="text"
                  placeholder="Concepto de la compra"
                  value={formCompra.nombre}
                  onChange={(e) => setFormCompra({ ...formCompra, nombre: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={formCompra.cantidad}
                  onChange={(e) => setFormCompra({ ...formCompra, cantidad: e.target.value })}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <select
                  value={formCompra.categoriaId}
                  onChange={(e) => setFormCompra({ ...formCompra, categoriaId: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Categoría (opcional)</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCompraAbierto(null)}
                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">Compras de este periodo</p>
              {comprasActual.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no tienes compras en este periodo.</p>
              ) : (
                <div className="space-y-2">
                  {comprasActual.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{c.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.categoria?.nombre ?? 'Sin categoría'} • {formatearDiaMes(new Date(c.fecha))}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="font-bold text-red-600 whitespace-nowrap">{formatearMoneda(c.cantidad)}</p>
                        <button onClick={() => handleEliminarCompra(c.id)} className="text-red-600 hover:text-red-800">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!mostrarFormTarjeta && (
        <button
          onClick={() => setMostrarFormTarjeta(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar tarjeta
        </button>
      )}

      {mostrarFormTarjeta && (
        <form onSubmit={handleSubmitTarjeta} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre de la tarjeta (ej: BBVA Oro)"
            value={formTarjeta.nombre}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, nombre: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Día de corte (1-31)"
            value={formTarjeta.diaCorte}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, diaCorte: e.target.value })}
            required
            min={1}
            max={31}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Pago que planeas hacer cada quincena (opcional)"
            value={formTarjeta.pagoQuincenal}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, pagoQuincenal: e.target.value })}
            step="0.01"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormTarjeta(false)}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
