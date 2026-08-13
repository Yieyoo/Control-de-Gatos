'use client';

import { useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IDashboardResumen } from '@/types';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
}

function formatearRangoQuincena(inicioISO: string, finISO: string): string {
  const inicio = new Date(inicioISO);
  const fin = new Date(finISO);
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${inicio.toLocaleDateString('es-MX', opciones)} – ${fin.toLocaleDateString('es-MX', opciones)}`;
}

export function ResumenFinanciero({ resumen }: ResumenFinancieroProps) {
  const [vista, setVista] = useState<'mes' | 'quincena'>('mes');
  const q = resumen.quincenaActual;
  const esMes = vista === 'mes';

  const tarjetas = [
    {
      titulo: esMes ? 'Ingresos al mes' : 'Ingresos de la quincena',
      cantidad: esMes ? resumen.ingresosTotales : q.ingresos,
      subtitulo:
        esMes && resumen.ingresosPorQuincena > 0
          ? `${formatearMoneda(resumen.ingresosPorQuincena)} por quincena`
          : undefined,
      badge: 'bg-blue-100',
      textColor: 'text-gray-900',
      icono: '📈',
    },
    {
      titulo: esMes ? 'Ahorro del mes' : 'Ahorro de la quincena',
      cantidad: esMes ? resumen.ahorroDelMes : q.ahorroDelMes,
      badge: 'bg-violet-100',
      textColor: 'text-gray-900',
      icono: '🐷',
    },
    {
      titulo: 'Gastos fijos',
      cantidad: esMes ? resumen.gastosFijos : q.gastosFijos,
      badge: 'bg-orange-100',
      textColor: 'text-gray-900',
      icono: '📄',
    },
    {
      titulo: 'Gastos variables',
      cantidad: esMes ? resumen.gastosVariables : q.gastosVariables,
      badge: 'bg-pink-100',
      textColor: 'text-gray-900',
      icono: '🛒',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Resumen</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          <button
            onClick={() => setVista('mes')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              esMes ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setVista('quincena')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              !esMes ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Quincena
          </button>
        </div>
      </div>

      {!esMes && (
        <p className="text-xs text-gray-500 mb-4">{formatearRangoQuincena(q.inicio, q.fin)}</p>
      )}
      {esMes && <div className="mb-4" />}

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
            {formatearMoneda(esMes ? resumen.dineroDisponible : q.dineroDisponible)}
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
