// src/app/historial-mensual/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatearMoneda } from '@/utils/calculos';
import type { IHistorialMensualResumen } from '@/types';
import { GraficaAnualModal } from '@/components/HistorialMensual/GraficaAnualModal';
import { CalendarDays, Calendar, ChevronDown, ArrowDown, ArrowUp, PiggyBank, TrendingUp } from 'lucide-react';

export default function HistorialMensualPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <HistorialMensualContenido />
    </Suspense>
  );
}

function HistorialMensualContenido() {
  const searchParams = useSearchParams();
  const añoInicial = parseInt(searchParams.get('año') ?? '', 10);
  const [datos, setDatos] = useState<IHistorialMensualResumen | null>(null);
  const [año, setAño] = useState<number | null>(Number.isInteger(añoInicial) ? añoInicial : null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarGrafica, setMostrarGrafica] = useState(false);

  useEffect(() => {
    setCargando(true);
    const url = año == null ? '/api/historial-mensual' : `/api/historial-mensual?año=${año}`;
    fetch(url)
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al cargar el historial mensual');
        return resp.json();
      })
      .then((data: IHistorialMensualResumen) => {
        setDatos(data);
        setAño(data.año);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setCargando(false));
  }, [año]);

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>;
  }

  if (cargando && !datos) return <div>Cargando...</div>;
  if (!datos) return null;

  const { meses, totales, añosDisponibles } = datos;

  // Referencia común para las barras: así una barra más alta/corta se puede
  // comparar de verdad entre meses, no solo dentro del mismo mes.
  const maxIngresos = Math.max(1, ...meses.map((m) => m.ingresos));
  const maxGastos = Math.max(1, ...meses.map((m) => m.gastos));
  const maxAhorro = Math.max(1, ...meses.map((m) => Math.abs(m.ahorro)));

  const columnas = [
    { clave: 'ingresos' as const, etiqueta: 'Ingresos', color: 'bg-green-500', textoColor: 'text-green-700', max: maxIngresos },
    { clave: 'gastos' as const, etiqueta: 'Gastos', color: 'bg-red-500', textoColor: 'text-red-700', max: maxGastos },
    { clave: 'ahorro' as const, etiqueta: 'Ahorro', color: 'bg-blue-500', textoColor: 'text-blue-700', max: maxAhorro },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarDays className="w-7 h-7" strokeWidth={1.75} /> Historial Mensual
        </h1>
        <p className="text-gray-600 mt-1">Compara ingresos, gastos y ahorro mes a mes durante el año</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" strokeWidth={1.75} />
          <select
            value={año ?? datos.año}
            onChange={(e) => setAño(parseInt(e.target.value, 10))}
            className="appearance-none bg-white border border-gray-200 rounded-full pl-9 pr-9 py-2 text-sm font-semibold text-gray-800 shadow-sm cursor-pointer"
          >
            {añosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
        </div>

        <button
          type="button"
          onClick={() => setMostrarGrafica(true)}
          disabled={meses.length === 0}
          className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <TrendingUp className="w-4 h-4" strokeWidth={1.75} /> Ver gráfica anual
        </button>
      </div>

      {meses.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Todavía no hay datos para {año}.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-1.5">
                <ArrowDown className="w-4 h-4" strokeWidth={2} />
              </div>
              <p className="text-xs text-gray-500">Ingresos totales</p>
              <p className="text-sm sm:text-base font-bold text-green-700 mt-0.5">{formatearMoneda(totales.ingresos)}</p>
            </div>
            <div>
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-1.5">
                <ArrowUp className="w-4 h-4" strokeWidth={2} />
              </div>
              <p className="text-xs text-gray-500">Gastos totales</p>
              <p className="text-sm sm:text-base font-bold text-red-700 mt-0.5">{formatearMoneda(totales.gastos)}</p>
            </div>
            <div>
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-1.5">
                <PiggyBank className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <p className="text-xs text-gray-500">Ahorro total</p>
              <p className="text-sm sm:text-base font-bold text-blue-700 mt-0.5">{formatearMoneda(totales.ahorro)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
            {meses.map((mes) => (
              <Link
                key={`${mes.año}-${mes.mes}`}
                href={`/historial-mensual/${mes.año}/${mes.mes}`}
                className="block px-4 py-3.5 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-900">{mes.etiqueta}</span>
                    {mes.actual && (
                      <span className="ml-2 inline-block text-[10px] font-semibold text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5 align-middle">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-gray-400 whitespace-nowrap" title="Ingresos - Gastos - Ahorro">
                      Balance
                    </span>
                    <span className={`text-sm font-bold whitespace-nowrap ${mes.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatearMoneda(mes.balance)}
                    </span>
                    <span className="text-gray-300">›</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {columnas.map((col) => {
                    const valor = mes[col.clave];
                    const ancho = Math.min(100, (Math.abs(valor) / col.max) * 100);
                    return (
                      <div key={col.clave} className="min-w-0">
                        <p className="text-[10px] text-gray-400">{col.etiqueta}</p>
                        <p className={`text-xs font-semibold ${col.textoColor} truncate`}>{formatearMoneda(valor)}</p>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                          <div className={`h-full rounded-full ${col.color}`} style={{ width: `${ancho}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-900">Balance acumulado del año</p>
                <p className="text-xs text-green-700/70">Ingresos - Gastos - Ahorro</p>
              </div>
            </div>
            <p
              className={`text-lg font-bold flex-shrink-0 ${totales.balance < 0 ? 'text-red-600' : 'text-green-700'}`}
            >
              {formatearMoneda(totales.balance)}
            </p>
          </div>
        </>
      )}

      {mostrarGrafica && (
        <GraficaAnualModal año={año ?? datos.año} meses={meses} onClose={() => setMostrarGrafica(false)} />
      )}
    </div>
  );
}
