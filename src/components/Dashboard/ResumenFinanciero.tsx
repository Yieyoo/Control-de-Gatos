// src/components/Dashboard/ResumenFinanciero.tsx
'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IDashboardResumen } from '@/types';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
}

export function ResumenFinanciero({ resumen }: ResumenFinancieroProps) {
  const tarjetas = [
    {
      titulo: 'Ingresos Estimados',
      cantidad: resumen.ingresosTotales,
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-600',
      icono: '📈',
    },
    {
      titulo: 'Ahorro Total',
      cantidad: resumen.ahorroTotal,
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-600',
      icono: '🏦',
    },
    {
      titulo: 'Ahorro del Mes',
      cantidad: resumen.ahorroDelMes,
      color: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-600',
      icono: '💜',
    },
    {
      titulo: 'Gastos Fijos',
      cantidad: resumen.gastosFijos,
      color: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-600',
      icono: '📌',
    },
    {
      titulo: 'Gastos Variables',
      cantidad: resumen.gastosVariables,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-600',
      icono: '🛒',
    },
    {
      titulo: 'Dinero Disponible',
      cantidad: resumen.dineroDisponible,
      color: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-600',
      icono: '💰',
      destacado: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tarjetas.map((tarjeta) => (
        <div
          key={tarjeta.titulo}
          className={`
            p-6 rounded-lg border-2 transition-all
            ${tarjeta.color}
            ${tarjeta.destacado ? 'lg:col-span-3 ring-2 ring-offset-2 ring-emerald-400' : ''}
          `}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{tarjeta.titulo}</p>
              <p className={`text-3xl font-bold mt-2 ${tarjeta.textColor}`}>
                {formatearMoneda(tarjeta.cantidad)}
              </p>
            </div>
            <span className="text-3xl">{tarjeta.icono}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
