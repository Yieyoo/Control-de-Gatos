'use client';

import { useEffect, useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IDeudaTarjeta, ICompraTarjeta } from '@/types';

interface DeudaTarjetasProps {
  tarjetas: IDeudaTarjeta[];
}

// timeZone: 'UTC' porque la fecha ya viene como medianoche UTC representando
// el día de calendario en que se hizo la compra.
function formatearFecha(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function DeudaTarjetas({ tarjetas }: DeudaTarjetasProps) {
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);

  useEffect(() => {
    if (tarjetas.length === 0) return;
    fetch('/api/tarjetas/compras')
      .then((resp) => (resp.ok ? resp.json() : []))
      .then(setCompras)
      .catch(() => {});
  }, [tarjetas.length]);

  if (tarjetas.length === 0) return null;

  const total = tarjetas.reduce((sum, t) => sum + t.debe, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">💳 Debo de tarjeta</h2>
      <div className="space-y-4">
        {tarjetas.map((t) => {
          const comprasTarjeta = compras.filter((c) => c.tarjetaId === t.id);
          return (
            <div key={t.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{t.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Corta el día {t.diaCorte}
                    {t.pagoQuincenal ? ` • Planeas pagar ${formatearMoneda(t.pagoQuincenal)}/quincena` : ''}
                  </p>
                </div>
                <p className="font-bold text-red-600 whitespace-nowrap flex-shrink-0">{formatearMoneda(t.debe)}</p>
              </div>
              {comprasTarjeta.length > 0 && (
                <ul className="mt-2 divide-y divide-gray-100">
                  {comprasTarjeta.map((c) => (
                    <li key={c.id} className="py-1.5 flex items-center gap-3">
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-700">{c.nombre}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatearFecha(c.fecha)}</span>
                      <span className="text-sm font-semibold text-red-600 flex-shrink-0 tabular-nums">
                        {formatearMoneda(c.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {tarjetas.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-gray-700">Total</p>
          <p className="font-bold text-red-600">{formatearMoneda(total)}</p>
        </div>
      )}
    </div>
  );
}
