// src/components/HistorialMensual/GraficaAnualModal.tsx
'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IMesResumen } from '@/types';
import { TrendingUp, X } from 'lucide-react';

interface GraficaAnualModalProps {
  año: number;
  meses: IMesResumen[];
  onClose: () => void;
}

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ALTO = 200;
const ANCHO_MES = 56;
const ANCHO_BARRA = 12;

export function GraficaAnualModal({ año, meses, onClose }: GraficaAnualModalProps) {
  // La API entrega los meses del más reciente al más antiguo; para leer la
  // gráfica de izquierda a derecha en orden cronológico se invierte aquí.
  const mesesOrdenados = [...meses].reverse();
  const max = Math.max(1, ...mesesOrdenados.flatMap((m) => [m.ingresos, m.gastos, Math.abs(m.ahorro)]));
  const anchoSvg = Math.max(320, mesesOrdenados.length * ANCHO_MES);

  const series: { clave: 'ingresos' | 'gastos' | 'ahorro'; color: string; etiqueta: string }[] = [
    { clave: 'ingresos', color: '#22c55e', etiqueta: 'Ingresos' },
    { clave: 'gastos', color: '#ef4444', etiqueta: 'Gastos' },
    { clave: 'ahorro', color: '#3b82f6', etiqueta: 'Ahorro' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" strokeWidth={1.75} /> Gráfica anual {año}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 px-1">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          {series.map((s) => (
            <span key={s.clave} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.etiqueta}
            </span>
          ))}
        </div>

        {mesesOrdenados.length === 0 ? (
          <p className="text-sm text-gray-500">No hay datos suficientes para graficar.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg width={anchoSvg} height={ALTO + 24} role="img" aria-label={`Gráfica de ingresos, gastos y ahorro por mes de ${año}`}>
              <line x1={0} y1={ALTO} x2={anchoSvg} y2={ALTO} stroke="#e5e7eb" strokeWidth={1} />
              {mesesOrdenados.map((mes, i) => {
                const cx = i * ANCHO_MES + ANCHO_MES / 2;
                return (
                  <g key={`${mes.año}-${mes.mes}`}>
                    {series.map((s, j) => {
                      const valor = Math.abs(mes[s.clave]);
                      const alto = (valor / max) * (ALTO - 10);
                      const x = cx - (ANCHO_BARRA * 1.5) + j * (ANCHO_BARRA + 2);
                      return (
                        <rect
                          key={s.clave}
                          x={x}
                          y={ALTO - alto}
                          width={ANCHO_BARRA}
                          height={Math.max(alto, valor > 0 ? 1 : 0)}
                          rx={2}
                          fill={s.color}
                        >
                          <title>{`${s.etiqueta} ${mes.etiqueta}: ${formatearMoneda(mes[s.clave])}`}</title>
                        </rect>
                      );
                    })}
                    <text x={cx} y={ALTO + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
                      {MESES_ABREV[mes.mes]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
