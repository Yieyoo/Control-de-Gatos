'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IPorcentajeDestino, IRubroPresupuesto } from '@/types';

interface PorcentajeDestinoProps {
  datos: IPorcentajeDestino;
}

const RUBROS: {
  clave: keyof IPorcentajeDestino;
  icono: string;
  titulo: string;
  colorTexto: string;
  colorBarra: string;
  colorFondoIcono: string;
  favorable: 'menorEsMejor' | 'mayorEsMejor';
}[] = [
  {
    clave: 'necesidades',
    icono: '🏠',
    titulo: 'Necesidades y gastos fijos',
    colorTexto: 'text-blue-700',
    colorBarra: 'bg-blue-500',
    colorFondoIcono: 'bg-blue-100',
    favorable: 'menorEsMejor',
  },
  {
    clave: 'gustos',
    icono: '🎮',
    titulo: 'Gustos y gastos personales',
    colorTexto: 'text-violet-700',
    colorBarra: 'bg-violet-500',
    colorFondoIcono: 'bg-violet-100',
    favorable: 'menorEsMejor',
  },
  {
    clave: 'ahorro',
    icono: '📈',
    titulo: 'Ahorro e inversión',
    colorTexto: 'text-green-700',
    colorBarra: 'bg-green-500',
    colorFondoIcono: 'bg-green-100',
    favorable: 'mayorEsMejor',
  },
];

function estaSobreLaMeta(rubro: IRubroPresupuesto, favorable: 'menorEsMejor' | 'mayorEsMejor'): boolean {
  return favorable === 'menorEsMejor' ? rubro.monto > rubro.metaMonto : rubro.monto < rubro.metaMonto;
}

export function PorcentajeDestino({ datos }: PorcentajeDestinoProps) {
  const irADetalle = () => {
    document.getElementById('gastos-por-categoria')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🥧</span> % destinado a
        </h2>
        <button
          type="button"
          onClick={irADetalle}
          className="text-xs font-medium border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-50 flex-shrink-0"
        >
          Ver detalle
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {RUBROS.map(({ clave, icono, titulo, colorTexto, colorBarra, colorFondoIcono, favorable }) => {
          const rubro = datos[clave];
          const sobreLaMeta = estaSobreLaMeta(rubro, favorable);
          const anchoBarra = Math.min(rubro.porcentaje, 100);

          return (
            <div key={clave} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg ${colorFondoIcono} flex items-center justify-center text-sm flex-shrink-0`}>
                  {icono}
                </span>
                <p className={`text-sm font-semibold ${colorTexto}`}>
                  {Math.round(rubro.metaPorcentaje)}% — {formatearMoneda(rubro.metaMonto)}
                </p>
              </div>
              <p className="text-xs text-gray-500 leading-tight">{titulo}</p>

              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${sobreLaMeta ? 'bg-amber-500' : colorBarra}`}
                  style={{ width: `${anchoBarra}%` }}
                />
              </div>

              <p className={`text-xs ${sobreLaMeta ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                {rubro.porcentaje.toFixed(1)}% ({formatearMoneda(rubro.monto)})
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
