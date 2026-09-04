'use client';

import { useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IPorcentajeDestino, IRubroPresupuesto } from '@/types';
import { Home, Gamepad2, TrendingUp, PieChart, X, type LucideIcon } from 'lucide-react';

interface PorcentajeDestinoProps {
  datos: IPorcentajeDestino;
}

const RUBROS: {
  clave: keyof IPorcentajeDestino;
  icono: LucideIcon;
  titulo: string;
  colorTexto: string;
  colorBarra: string;
  colorFondoIcono: string;
  favorable: 'menorEsMejor' | 'mayorEsMejor';
}[] = [
  {
    clave: 'necesidades',
    icono: Home,
    titulo: 'Necesidades y gastos fijos',
    colorTexto: 'text-blue-700',
    colorBarra: 'bg-blue-500',
    colorFondoIcono: 'bg-blue-100',
    favorable: 'menorEsMejor',
  },
  {
    clave: 'gustos',
    icono: Gamepad2,
    titulo: 'Gustos y gastos personales',
    colorTexto: 'text-violet-700',
    colorBarra: 'bg-violet-500',
    colorFondoIcono: 'bg-violet-100',
    favorable: 'menorEsMejor',
  },
  {
    clave: 'ahorro',
    icono: TrendingUp,
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
  const [rubroAbierto, setRubroAbierto] = useState<keyof IPorcentajeDestino | null>(null);
  const rubroInfo = RUBROS.find((r) => r.clave === rubroAbierto);
  const rubroDatos = rubroAbierto ? datos[rubroAbierto] : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-gray-700" strokeWidth={1.75} /> % destinado a
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {RUBROS.map(({ clave, icono: Icono, titulo, colorTexto, colorBarra, colorFondoIcono, favorable }) => {
          const rubro = datos[clave];
          const sobreLaMeta = estaSobreLaMeta(rubro, favorable);
          // % de tu límite ya usado (no % de tu ingreso total) -- así la barra
          // se llena justo al 100% cuando llegas al tope, no a una fracción
          // chica de la barra que no dice nada sobre qué tan cerca estás.
          const porcentajeDelLimite = rubro.metaMonto > 0 ? (rubro.monto / rubro.metaMonto) * 100 : 0;
          const anchoBarra = Math.min(porcentajeDelLimite, 100);

          return (
            <button
              key={clave}
              type="button"
              onClick={() => setRubroAbierto(clave)}
              className="text-left space-y-1.5 rounded-lg p-1 -m-1 active:bg-gray-50"
            >
              <div className="flex items-center gap-1">
                <span className={`w-5 h-5 rounded-md ${colorFondoIcono} flex items-center justify-center flex-shrink-0`}>
                  <Icono className={`w-3 h-3 ${colorTexto}`} strokeWidth={2} />
                </span>
                <p className={`text-[11px] font-semibold leading-tight ${colorTexto}`}>
                  {Math.round(rubro.metaPorcentaje)}% — {formatearMoneda(rubro.metaMonto)}
                </p>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight flex items-start gap-0.5">
                <span className="flex-1">{titulo}</span>
                <span className="text-gray-300 flex-shrink-0">›</span>
              </p>

              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${sobreLaMeta ? 'bg-amber-500' : colorBarra}`}
                  style={{ width: `${anchoBarra}%` }}
                />
              </div>

              <p className={`text-[10px] leading-tight ${sobreLaMeta ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                {porcentajeDelLimite.toFixed(1)}% de tu límite ({formatearMoneda(rubro.monto)})
              </p>
            </button>
          );
        })}
      </div>

      {rubroAbierto && rubroInfo && rubroDatos && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setRubroAbierto(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] flex flex-col bg-white rounded-t-2xl p-5 pb-6 shadow-lg">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 flex-shrink-0" />
            <div className="flex items-start justify-between gap-3 mb-1 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <rubroInfo.icono className="w-5 h-5 text-gray-700" strokeWidth={1.75} /> {rubroInfo.titulo}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatearMoneda(rubroDatos.monto)} de {formatearMoneda(rubroDatos.metaMonto)} meta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRubroAbierto(null)}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <div className="overflow-y-auto mt-3 -mx-1 px-1">
              {rubroDatos.items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">Todavía no hay gastos en este rubro para este periodo.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {rubroDatos.items.map((item, i) => (
                    <li key={i} className="py-2.5 flex items-center gap-3">
                      {item.categoriaColor && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.categoriaColor }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 truncate">{item.nombre}</p>
                        {item.categoriaNombre && (
                          <p className="text-xs text-gray-500 truncate">{item.categoriaNombre}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">
                        {formatearMoneda(item.cantidad)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
