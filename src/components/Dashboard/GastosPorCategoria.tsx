'use client';

import { formatearMoneda } from '@/utils/calculos';
import type { IGastoPorCategoria } from '@/types';

interface GastosPorCategoriaProps {
  categorias: IGastoPorCategoria[];
}

export function GastosPorCategoria({ categorias }: GastosPorCategoriaProps) {
  return (
    <div id="gastos-por-categoria" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Gastos por categoría</h2>

      {categorias.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no tienes gastos registrados este mes.</p>
      ) : (
        <>
          {/* Barra apilada: proporción de cada categoría sobre el total del mes */}
          <div className="flex h-5 w-full gap-[2px] rounded-md overflow-hidden mb-5">
            {categorias.map((cat) => (
              <div
                key={cat.categoriaId}
                title={`${cat.nombre}: ${formatearMoneda(cat.monto)} (${cat.porcentaje.toFixed(0)}%)`}
                style={{ backgroundColor: cat.color, width: `${cat.porcentaje}%` }}
                className="h-full min-w-[2px]"
              />
            ))}
          </div>

          {/* Leyenda: identidad + valores, nunca solo color */}
          <ul className="space-y-2.5">
            {categorias.map((cat) => (
              <li key={cat.categoriaId} className="flex items-center gap-3 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-gray-700 flex-1 truncate">{cat.nombre}</span>
                <span className="text-gray-900 font-medium tabular-nums">{formatearMoneda(cat.monto)}</span>
                <span className="text-gray-500 w-10 text-right tabular-nums">{cat.porcentaje.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
