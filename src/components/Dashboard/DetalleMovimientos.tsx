'use client';

import { useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IMovimientoPeriodo } from '@/types';

interface DetalleMovimientosProps {
  etiqueta: string;
  movimientos: IMovimientoPeriodo[];
  onAhorroActualizado: () => void;
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

export function DetalleMovimientos({ etiqueta, movimientos, onAhorroActualizado }: DetalleMovimientosProps) {
  const [enviando, setEnviando] = useState<number | null>(null);
  const gastos = movimientos.filter((m) => m.tipo === 'gasto');
  const ahorros = movimientos.filter((m) => m.tipo === 'ahorro');

  const handleToggleEnviado = async (m: IMovimientoPeriodo) => {
    if (!m.ahorroDomiciliadoId) return;
    setEnviando(m.ahorroDomiciliadoId);
    try {
      const resp = await fetch(`/api/ahorros/domiciliados/${m.ahorroDomiciliadoId}/confirmar`, {
        method: m.pagado ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: m.fecha }),
      });
      if (!resp.ok) throw new Error('Error al actualizar el ahorro');
      onAhorroActualizado();
    } catch (err) {
      console.error(err);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Detalle de {etiqueta}</h2>
      <p className="text-xs text-gray-500 mb-4">
        En gris lo que ya salió de tu cuenta; en naranja lo que todavía no llega. En ahorros, marca la
        palomita cuando realmente hagas la transferencia.
      </p>

      {movimientos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay gastos ni ahorros programados en este periodo.</p>
      ) : (
        <div className="space-y-5">
          {gastos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Gastos</p>
              <ul className="divide-y divide-gray-100">
                {gastos.map((m, i) => (
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
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ahorros.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ahorros</p>
              <ul className="divide-y divide-gray-100">
                {ahorros.map((m, i) => (
                  <li key={i} className="py-2 flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: m.pagado ? '#c3c2b7' : '#2a78d6' }}
                    />
                    <span className={`flex-1 min-w-0 truncate text-sm ${m.pagado ? 'text-gray-400' : 'text-gray-900'}`}>
                      {m.nombre}
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
                        disabled={enviando === m.ahorroDomiciliadoId}
                        onChange={() => handleToggleEnviado(m)}
                        title="¿Ya enviaste este ahorro?"
                        className="w-4 h-4 flex-shrink-0"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
