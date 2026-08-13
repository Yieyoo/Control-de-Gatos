'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IDashboardResumen } from '@/types';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
}

export function ResumenFinanciero({ resumen }: ResumenFinancieroProps) {
  const tarjetas = [
    {
      titulo: 'Ingresos al mes',
      cantidad: resumen.ingresosTotales,
      subtitulo:
        resumen.ingresosPorQuincena > 0
          ? `${formatearMoneda(resumen.ingresosPorQuincena)} por quincena`
          : undefined,
      badge: 'bg-blue-100',
      textColor: 'text-gray-900',
      icono: '📈',
    },
    {
      titulo: 'Ahorro del mes',
      cantidad: resumen.ahorroDelMes,
      badge: 'bg-violet-100',
      textColor: 'text-gray-900',
      icono: '🐷',
    },
    {
      titulo: 'Gastos fijos',
      cantidad: resumen.gastosFijos,
      badge: 'bg-orange-100',
      textColor: 'text-gray-900',
      icono: '📄',
    },
    {
      titulo: 'Gastos variables',
      cantidad: resumen.gastosVariables,
      badge: 'bg-pink-100',
      textColor: 'text-gray-900',
      icono: '🛒',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Resumen del mes</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.titulo} className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${tarjeta.badge} flex items-center justify-center text-lg flex-shrink-0`}>
              {tarjeta.icono}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-tight">{tarjeta.titulo}</p>
              <p className={`text-sm sm:text-lg font-bold ${tarjeta.textColor} leading-tight`}>
                {formatearMoneda(tarjeta.cantidad)}
              </p>
              {tarjeta.subtitulo && (
                <p className="text-xs text-gray-400 leading-tight">{tarjeta.subtitulo}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💵</span>
            <p className="text-xs font-medium text-green-800">Dinero disponible</p>
          </div>
          <p className="text-base sm:text-xl font-bold text-green-700 leading-tight">
            {formatearMoneda(resumen.dineroDisponible)}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏛️</span>
            <p className="text-xs font-medium text-blue-800">Ahorro total</p>
          </div>
          <p className="text-base sm:text-xl font-bold text-blue-700 leading-tight">
            {formatearMoneda(resumen.ahorroTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
