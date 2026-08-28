'use client';

import { useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IMovimientoPeriodo } from '@/types';

interface DetalleMovimientosProps {
  etiqueta: string;
  movimientos: IMovimientoPeriodo[];
  onActualizar: () => void;
}

// timeZone: 'UTC' es a propósito -- la fecha ya viene como medianoche UTC
// representando el día de calendario (ver calculos.ts), así que se lee tal
// cual en vez de convertirla a la hora local del navegador.
function formatearFecha(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

export function DetalleMovimientos({ etiqueta, movimientos, onActualizar }: DetalleMovimientosProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const gastos = movimientos.filter((m) => m.tipo === 'gasto');
  const ahorros = movimientos.filter((m) => m.tipo === 'ahorro');

  /** Confirma/deshace un gasto domiciliado en efectivo o un ahorro domiciliado -- misma mecánica, distinto endpoint. */
  const handleToggleConfirmado = async (m: IMovimientoPeriodo, tipo: 'gasto' | 'ahorro') => {
    const id = tipo === 'gasto' ? m.gastoDomiciliadoId : m.ahorroDomiciliadoId;
    if (id == null) return;
    const clave = `${tipo}-${id}-${m.fecha}`;
    setConfirmando(clave);
    try {
      const base = tipo === 'gasto' ? '/api/gastos/domiciliados' : '/api/ahorros/domiciliados';
      const resp = await fetch(`${base}/${id}/confirmar`, {
        method: m.pagado ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: m.fecha }),
      });
      if (!resp.ok) throw new Error('Error al actualizar');
      onActualizar();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmando(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Detalle de {etiqueta}</h2>
      <p className="text-xs text-gray-500 mb-4">
        En gris lo que ya confirmaste; en rojo/azul lo que todavía falta. Marca la palomita cuando el cargo o el
        ahorro realmente ocurra -- un compromiso pendiente no significa que el dinero ya salió.
      </p>

      {movimientos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay gastos ni ahorros programados en este periodo.</p>
      ) : (
        <div className="space-y-5">
          {gastos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Gastos</p>
              <ul className="divide-y divide-gray-100">
                {gastos.map((m, i) => {
                  const clave = `gasto-${m.gastoDomiciliadoId}-${m.fecha}`;
                  return (
                    <li key={i} className="py-2 flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: m.categoriaColor ?? '#e34948' }}
                      />
                      <span className={`flex-1 min-w-0 truncate text-sm ${m.pagado ? 'text-gray-400' : 'text-gray-900'}`}>
                        {m.nombre}
                        {m.credito && ' 💳'}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatearFecha(m.fecha)}</span>
                      <span
                        className={`text-sm font-semibold flex-shrink-0 tabular-nums ${
                          m.pagado ? 'text-gray-400' : 'text-red-600'
                        }`}
                      >
                        {formatearMoneda(m.cantidad)}
                      </span>
                      {m.gastoDomiciliadoId != null && (
                        <input
                          type="checkbox"
                          checked={m.pagado}
                          disabled={confirmando === clave}
                          onChange={() => handleToggleConfirmado(m, 'gasto')}
                          title="¿Ya se cobró este gasto?"
                          className="w-4 h-4 flex-shrink-0"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {ahorros.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ahorros</p>
              <ul className="divide-y divide-gray-100">
                {ahorros.map((m, i) => {
                  const clave = `ahorro-${m.ahorroDomiciliadoId}-${m.fecha}`;
                  return (
                    <li key={i} className="py-2 flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: m.pagado ? '#c3c2b7' : '#2a78d6' }}
                      />
                      <span className={`flex-1 min-w-0 truncate text-sm ${m.pagado ? 'text-gray-400' : 'text-gray-900'}`}>
                        {m.nombre}
                        {m.obligatorio === false && (
                          <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 align-middle">
                            Opcional
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatearFecha(m.fecha)}</span>
                      <span
                        className={`text-sm font-semibold flex-shrink-0 tabular-nums ${
                          m.pagado ? 'text-gray-400' : 'text-blue-600'
                        }`}
                      >
                        {formatearMoneda(m.cantidad)}
                      </span>
                      {m.ahorroDomiciliadoId != null && (
                        <input
                          type="checkbox"
                          checked={m.pagado}
                          disabled={confirmando === clave}
                          onChange={() => handleToggleConfirmado(m, 'ahorro')}
                          title="¿Ya enviaste este ahorro?"
                          className="w-4 h-4 flex-shrink-0"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
