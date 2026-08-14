// src/app/historial-mensual/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IMesResumen } from '@/types';

export default function HistorialMensualPage() {
  const [meses, setMeses] = useState<IMesResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/historial-mensual')
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al cargar el historial mensual');
        return resp.json();
      })
      .then(setMeses)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div>Cargando...</div>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  // Referencia común para las barras: así una barra más alta/corta se puede
  // comparar de verdad entre meses, no solo dentro del mismo mes.
  const maxIngresos = Math.max(1, ...meses.map((m) => m.ingresos));
  const maxGastos = Math.max(1, ...meses.map((m) => m.gastos));
  const maxAhorro = Math.max(1, ...meses.map((m) => Math.abs(m.ahorro)));

  const filas = [
    { clave: 'ingresos' as const, etiqueta: 'Ingresos', color: 'bg-green-500', textoColor: 'text-green-700', max: maxIngresos },
    { clave: 'gastos' as const, etiqueta: 'Gastos', color: 'bg-red-500', textoColor: 'text-red-700', max: maxGastos },
    { clave: 'ahorro' as const, etiqueta: 'Ahorro', color: 'bg-blue-500', textoColor: 'text-blue-700', max: maxAhorro },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🗓️ Historial Mensual</h1>
        <p className="text-gray-600 mt-1">Compara ingresos, gastos y ahorro mes a mes durante el año</p>
      </div>

      {meses.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Todavía no hay datos para este año.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meses.map((mes) => (
            <div key={`${mes.año}-${mes.mes}`} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
              <h2 className="text-lg font-bold text-gray-900">{mes.etiqueta}</h2>
              <div className="space-y-2.5">
                {filas.map((fila) => {
                  const valor = mes[fila.clave];
                  const ancho = Math.min(100, (Math.abs(valor) / fila.max) * 100);
                  return (
                    <div key={fila.clave}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{fila.etiqueta}</span>
                        <span className={`font-semibold ${fila.textoColor}`}>{formatearMoneda(valor)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${fila.color}`} style={{ width: `${ancho}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
