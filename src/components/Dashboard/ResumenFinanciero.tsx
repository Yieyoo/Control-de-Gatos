'use client';

import { useState, useEffect } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IDashboardResumen, IResumenPeriodo } from '@/types';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
}

const CLAVE_OCULTAR_AHORRO = 'ocultarAhorroTotal';

export function ResumenFinanciero({ resumen }: ResumenFinancieroProps) {
  const [vista, setVista] = useState<'mes' | 'quincena1' | 'quincena2'>('mes');
  const [ocultarAhorro, setOcultarAhorro] = useState(false);
  const p: IResumenPeriodo = resumen.periodos[vista];

  useEffect(() => {
    setOcultarAhorro(localStorage.getItem(CLAVE_OCULTAR_AHORRO) === '1');
  }, []);

  const alternarOcultarAhorro = () => {
    setOcultarAhorro((previo) => {
      const nuevo = !previo;
      localStorage.setItem(CLAVE_OCULTAR_AHORRO, nuevo ? '1' : '0');
      return nuevo;
    });
  };

  const tarjetas = [
    {
      titulo: 'Ingresos',
      cantidad: p.ingresos,
      badge: 'bg-blue-100',
      icono: '📈',
    },
    {
      titulo: 'Ahorro',
      cantidad: p.ahorroDelMes,
      subtitulo: p.ahorroDelMesPendiente > 0 ? `+${formatearMoneda(p.ahorroDelMesPendiente)} pendiente` : undefined,
      badge: 'bg-violet-100',
      icono: '🐷',
    },
    {
      titulo: 'Gastos fijos',
      cantidad: p.gastosFijos,
      subtitulo: p.gastosFijosPendiente > 0 ? `+${formatearMoneda(p.gastosFijosPendiente)} pendiente` : undefined,
      badge: 'bg-orange-100',
      icono: '📄',
    },
    {
      titulo: 'Gastos variables',
      cantidad: p.gastosVariables,
      badge: 'bg-pink-100',
      icono: '🛒',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Resumen</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          {(['mes', 'quincena1', 'quincena2'] as const).map((opcion) => (
            <button
              key={opcion}
              onClick={() => setVista(opcion)}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                vista === opcion ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {opcion === 'mes' ? 'Mes' : opcion === 'quincena1' ? 'Q1' : 'Q2'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">{p.rangoTexto}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.titulo} className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${tarjeta.badge} flex items-center justify-center text-lg flex-shrink-0`}>
              {tarjeta.icono}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-tight">{tarjeta.titulo}</p>
              <p className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                {formatearMoneda(tarjeta.cantidad)}
              </p>
              {tarjeta.subtitulo && (
                <p className="text-xs text-amber-600 leading-tight">{tarjeta.subtitulo}</p>
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
            {formatearMoneda(p.dineroDisponible)}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <p className="text-xs font-medium text-blue-800">Ahorro total</p>
            </div>
            <button
              type="button"
              onClick={alternarOcultarAhorro}
              aria-label={ocultarAhorro ? 'Mostrar ahorro total' : 'Ocultar ahorro total'}
              className="text-blue-700/60 hover:text-blue-700"
            >
              {ocultarAhorro ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-base sm:text-xl font-bold text-blue-700 leading-tight">
            {ocultarAhorro ? '•••••••' : formatearMoneda(resumen.ahorroTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
