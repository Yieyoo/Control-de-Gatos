'use client';

import { useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IDashboardResumen, IResumenPeriodo } from '@/types';

type Vista = 'mes' | 'quincena1' | 'quincena2';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
  vista: Vista;
  onCambiarVista: (vista: Vista) => void;
}

const PIN_AHORRO = '1296';

export function ResumenFinanciero({ resumen, vista, onCambiarVista }: ResumenFinancieroProps) {
  // Ahorro total empieza oculto siempre que se abre la app; solo se destapa con el PIN.
  const [ocultarAhorro, setOcultarAhorro] = useState(true);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinIncorrecto, setPinIncorrecto] = useState(false);
  const p: IResumenPeriodo = resumen.periodos[vista];

  const abrirPromptPin = () => {
    setPin('');
    setPinIncorrecto(false);
    setPidiendoPin(true);
  };

  const ocultarDeNuevo = () => {
    setOcultarAhorro(true);
    setPidiendoPin(false);
    setPin('');
  };

  const handleSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_AHORRO) {
      setOcultarAhorro(false);
      setPidiendoPin(false);
      setPin('');
      setPinIncorrecto(false);
    } else {
      setPinIncorrecto(true);
      setPin('');
    }
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
          {(['quincena1', 'quincena2', 'mes'] as const).map((opcion) => (
            <button
              key={opcion}
              onClick={() => onCambiarVista(opcion)}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                vista === opcion ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {opcion === 'mes' ? 'Mes' : opcion === 'quincena1' ? 'Actual' : 'Próxima'}
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
            <p className="text-xs font-medium text-green-800">Dinero total</p>
          </div>
          <p className="text-base sm:text-xl font-bold text-green-700 leading-tight">
            {formatearMoneda(p.dineroDisponible)}
          </p>
          <div className="mt-2 pt-2 border-t border-green-200">
            <p className="text-xs font-medium text-green-800">Dinero real</p>
            <p
              className={`text-sm sm:text-base font-bold leading-tight ${
                p.dineroReal < 0 ? 'text-red-600' : 'text-green-700'
              }`}
            >
              {formatearMoneda(p.dineroReal)}
            </p>
            <p className="text-[11px] text-green-800/60 leading-tight">con pendientes ya liquidados</p>
          </div>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <p className="text-xs font-medium text-blue-800">Ahorro total</p>
            </div>
            <button
              type="button"
              onClick={ocultarAhorro ? abrirPromptPin : ocultarDeNuevo}
              aria-label={ocultarAhorro ? 'Mostrar ahorro total' : 'Ocultar ahorro total'}
              className="text-blue-700/60 hover:text-blue-700"
            >
              {ocultarAhorro ? '🙈' : '👁️'}
            </button>
          </div>

          {pidiendoPin ? (
            <form onSubmit={handleSubmitPin} className="mt-1">
              <div className="flex gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinIncorrecto(false);
                  }}
                  className={`min-w-0 flex-1 border rounded px-2 py-1 text-sm ${
                    pinIncorrecto ? 'border-red-400' : 'border-blue-300'
                  }`}
                />
                <button
                  type="submit"
                  className="flex-shrink-0 bg-blue-600 text-white text-sm font-medium px-2.5 rounded hover:bg-blue-700"
                >
                  ✓
                </button>
              </div>
              {pinIncorrecto && <p className="text-[11px] text-red-600 mt-1">PIN incorrecto</p>}
            </form>
          ) : (
            <>
              <p className="text-base sm:text-xl font-bold text-blue-700 leading-tight">
                {ocultarAhorro ? '•••••••' : formatearMoneda(resumen.ahorroTotal)}
              </p>
              {resumen.ahorrosLugares.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200 space-y-0.5">
                  {resumen.ahorrosLugares.map((ahorro) => (
                    <div key={ahorro.id} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-blue-800/70 truncate">{ahorro.nombre}</span>
                      <span className="text-[11px] font-semibold text-blue-800 flex-shrink-0">
                        {ocultarAhorro ? '•••' : formatearMoneda(ahorro.saldoActual)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
