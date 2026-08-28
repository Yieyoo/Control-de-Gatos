'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IProximoMovimiento } from '@/types';
import { PiggyBank, Repeat } from 'lucide-react';

interface ProximosMovimientosProps {
  movimientos: IProximoMovimiento[];
}

const etiquetaFrecuencia: Record<string, string> = {
  mensual: 'Mensual',
  quincenal: 'Cada quincena',
  semanal: 'Cada semana',
};

// La fecha viene del servidor como medianoche UTC representando un día de
// calendario (ver calculos.ts). Por eso se lee con getUTC* en vez de local:
// así no se recorre un día al convertir a la hora del navegador.
function formatearFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const mañana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);

  const mismoDiaUTC = (fechaUTC: Date, fechaLocal: Date) =>
    fechaUTC.getUTCFullYear() === fechaLocal.getFullYear() &&
    fechaUTC.getUTCMonth() === fechaLocal.getMonth() &&
    fechaUTC.getUTCDate() === fechaLocal.getDate();

  if (mismoDiaUTC(fecha, hoy)) return 'Hoy';
  if (mismoDiaUTC(fecha, mañana)) return 'Mañana';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function ProximosMovimientos({ movimientos }: ProximosMovimientosProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Próximos movimientos</h2>

      {movimientos.length === 0 ? (
        <p className="text-sm text-gray-500">No tienes gastos ni ahorros programados.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {movimientos.map((mov) => {
            const esAhorro = mov.tipo === 'ahorro_domiciliado';
            return (
              <li key={mov.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: esAhorro ? '#dbeafe' : (mov.categoriaColor ? `${mov.categoriaColor}22` : '#fee2e2') }}
                >
                  {esAhorro ? (
                    <PiggyBank className="w-4 h-4 text-blue-700" strokeWidth={1.75} />
                  ) : (
                    <Repeat className="w-4 h-4 text-red-600" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{mov.nombre}</p>
                  <p className="text-xs text-gray-500">{etiquetaFrecuencia[mov.frecuencia] ?? mov.frecuencia}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-semibold tabular-nums ${esAhorro ? 'text-blue-600' : 'text-red-600'}`}>
                    -{formatearMoneda(mov.cantidad)}
                  </p>
                  <p className="text-xs text-gray-500">{formatearFecha(mov.proximaFecha)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
