// src/app/ahorros/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IAhorroLugar, IMovimientoAhorro } from '@/types';
import { formatearMoneda, formatearDiaMes } from '@/utils/calculos';

export default function AhorrosPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <AhorrosContenido />
    </Suspense>
  );
}

function AhorrosContenido() {
  const searchParams = useSearchParams();
  const [ahorros, setAhorros] = useState<IAhorroLugar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(() => searchParams.get('nuevo') === '1');
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'cuenta_ahorro' as const,
    saldoActual: '',
    notas: '',
  });

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formEdicion, setFormEdicion] = useState({
    nombre: '',
    tipo: 'cuenta_ahorro',
    saldoActual: '',
    notas: '',
  });

  const [movimientos, setMovimientos] = useState<IMovimientoAhorro[]>([]);
  const [formMovAbierto, setFormMovAbierto] = useState<number | null>(null);
  const [formMov, setFormMov] = useState({ tipo: 'deposito', cantidad: '', concepto: '' });

  useEffect(() => {
    cargarAhorros();
    cargarMovimientos();
  }, []);

  const cargarAhorros = async () => {
    try {
      const resp = await fetch('/api/ahorros');
      if (!resp.ok) throw new Error('Error al cargar ahorros');
      const datos = await resp.json();
      setAhorros(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const cargarMovimientos = async () => {
    try {
      const resp = await fetch('/api/ahorros/movimientos');
      if (resp.ok) setMovimientos(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/ahorros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          saldoActual: parseFloat(formData.saldoActual || '0'),
        }),
      });

      if (!resp.ok) throw new Error('Error al crear ahorro');
      setFormData({ nombre: '', tipo: 'cuenta_ahorro', saldoActual: '', notas: '' });
      setMostrarFormulario(false);
      cargarAhorros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro?')) return;
    try {
      const resp = await fetch(`/api/ahorros/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarAhorros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const iniciarEdicion = (ahorro: IAhorroLugar) => {
    setEditandoId(ahorro.id);
    setFormEdicion({
      nombre: ahorro.nombre,
      tipo: ahorro.tipo,
      saldoActual: String(ahorro.saldoActual),
      notas: ahorro.notas || '',
    });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
  };

  const handleGuardarEdicion = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    try {
      const resp = await fetch(`/api/ahorros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formEdicion,
          saldoActual: parseFloat(formEdicion.saldoActual || '0'),
        }),
      });
      if (!resp.ok) throw new Error('Error al actualizar ahorro');
      setEditandoId(null);
      cargarAhorros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitMovimiento = async (e: React.FormEvent, ahorroId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/ahorros/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formMov, ahorroId }),
      });
      if (!resp.ok) throw new Error('Error al registrar movimiento');
      setFormMov({ tipo: 'deposito', cantidad: '', concepto: '' });
      setFormMovAbierto(null);
      cargarAhorros();
      cargarMovimientos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarMovimiento = async (id: number) => {
    if (!confirm('¿Eliminar este movimiento? El saldo se ajustará de nuevo.')) return;
    try {
      const resp = await fetch(`/api/ahorros/movimientos/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar movimiento');
      cargarAhorros();
      cargarMovimientos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const totalAhorros = ahorros.reduce((sum, a) => sum + a.saldoActual, 0);
  const tipoIconos: Record<string, string> = {
    cuenta_ahorro: '🏦',
    inversion: '📈',
    efectivo: '💵',
    otra: '💼',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏦 Mis Ahorros</h1>
        <p className="text-gray-600 mt-1">Administra tus cuentas y lugares de ahorro</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Ahorro Total</p>
        <p className="text-3xl font-bold text-blue-600">{formatearMoneda(totalAhorros)}</p>
      </div>

      {/* Botón agregar */}
      {!mostrarFormulario && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar Lugar de Ahorro
        </button>
      )}

      {/* Formulario */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre de la cuenta (ej: Fondo Emergencias)"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          
          <select
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="cuenta_ahorro">Cuenta de Ahorro</option>
            <option value="inversion">Inversión</option>
            <option value="efectivo">Efectivo</option>
            <option value="otra">Otra</option>
          </select>

          <input
            type="number"
            placeholder="Saldo Actual"
            value={formData.saldoActual}
            onChange={(e) => setFormData({ ...formData, saldoActual: e.target.value })}
            step="0.01"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ahorros.map((ahorro) =>
          editandoId === ahorro.id ? (
            <form
              key={ahorro.id}
              onSubmit={(e) => handleGuardarEdicion(e, ahorro.id)}
              className="bg-white border border-blue-300 rounded-lg p-6 space-y-3"
            >
              <input
                type="text"
                placeholder="Nombre"
                value={formEdicion.nombre}
                onChange={(e) => setFormEdicion({ ...formEdicion, nombre: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <select
                value={formEdicion.tipo}
                onChange={(e) => setFormEdicion({ ...formEdicion, tipo: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="cuenta_ahorro">Cuenta de Ahorro</option>
                <option value="inversion">Inversión</option>
                <option value="efectivo">Efectivo</option>
                <option value="otra">Otra</option>
              </select>
              <input
                type="number"
                placeholder="Saldo Actual"
                value={formEdicion.saldoActual}
                onChange={(e) => setFormEdicion({ ...formEdicion, saldoActual: e.target.value })}
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <textarea
                placeholder="Notas (opcional)"
                value={formEdicion.notas}
                onChange={(e) => setFormEdicion({ ...formEdicion, notas: e.target.value })}
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
                  onClick={cancelarEdicion}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div
              key={ahorro.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{tipoIconos[ahorro.tipo] || '💼'}</span>
                    <p className="font-semibold text-lg">{ahorro.nombre}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{ahorro.tipo}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => iniciarEdicion(ahorro)}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label={`Editar ${ahorro.nombre}`}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleEliminar(ahorro.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <p className="text-3xl font-bold text-blue-600 mb-3">
                {formatearMoneda(ahorro.saldoActual)}
              </p>

              {ahorro.notas && (
                <p className="text-sm text-gray-600 italic">{ahorro.notas}</p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                {formMovAbierto !== ahorro.id ? (
                  <button
                    onClick={() => setFormMovAbierto(ahorro.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    ➕ Registrar movimiento
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => handleSubmitMovimiento(e, ahorro.id)}
                    className="space-y-2 bg-gray-50 rounded-lg p-3"
                  >
                    <select
                      value={formMov.tipo}
                      onChange={(e) => setFormMov({ ...formMov, tipo: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      <option value="deposito">Depósito (suma al saldo)</option>
                      <option value="retiro">Retiro (resta del saldo)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Concepto (ej: Aportación extra)"
                      value={formMov.concepto}
                      onChange={(e) => setFormMov({ ...formMov, concepto: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Cantidad"
                      value={formMov.cantidad}
                      onChange={(e) => setFormMov({ ...formMov, cantidad: e.target.value })}
                      required
                      step="0.01"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormMovAbierto(null)}
                        className="bg-gray-400 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {movimientos.filter((m) => m.ahorroId === ahorro.id).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {movimientos
                      .filter((m) => m.ahorroId === ahorro.id)
                      .map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-gray-700">
                            {m.tipo === 'deposito' ? '➕' : '➖'} {m.concepto}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatearDiaMes(new Date(m.fecha))}
                          </span>
                          <span
                            className={`font-semibold flex-shrink-0 ${
                              m.tipo === 'deposito' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {m.tipo === 'deposito' ? '+' : '-'}
                            {formatearMoneda(m.cantidad)}
                          </span>
                          <button
                            onClick={() => handleEliminarMovimiento(m.id)}
                            className="text-gray-400 hover:text-red-600 flex-shrink-0"
                            aria-label="Eliminar movimiento"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {ahorros.length === 0 && !mostrarFormulario && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No tienes lugares de ahorro registrados</p>
        </div>
      )}
    </div>
  );
}
