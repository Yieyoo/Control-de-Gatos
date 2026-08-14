'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IDeudaTarjeta } from '@/types';

interface DeudaTarjetasProps {
  tarjetas: IDeudaTarjeta[];
}

export function DeudaTarjetas({ tarjetas }: DeudaTarjetasProps) {
  if (tarjetas.length === 0) return null;

  const total = tarjetas.reduce((sum, t) => sum + t.debe, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">💳 Debo de tarjeta</h2>
      <div className="space-y-3">
        {tarjetas.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{t.nombre}</p>
              <p className="text-xs text-gray-500 truncate">
                Corta el día {t.diaCorte}
                {t.pagoQuincenal ? ` • Planeas pagar ${formatearMoneda(t.pagoQuincenal)}/quincena` : ''}
              </p>
            </div>
            <p className="font-bold text-red-600 whitespace-nowrap flex-shrink-0">{formatearMoneda(t.debe)}</p>
          </div>
        ))}
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
