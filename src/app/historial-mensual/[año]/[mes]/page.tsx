// src/app/historial-mensual/[año]/[mes]/page.tsx
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatearMoneda } from '@/utils/calculos';
import type { IMesDetalle } from '@/types';
import { DetalleMovimientos } from '@/components/Dashboard/DetalleMovimientos';
import { ArrowLeft, TrendingUp, FileText, ShoppingCart, PiggyBank, CreditCard } from 'lucide-react';

export default function DetalleMesPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <DetalleMesContenido />
    </Suspense>
  );
}

function formatearFecha(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function DetalleMesContenido() {
  const params = useParams<{ año: string; mes: string }>();
  const [detalle, setDetalle] = useState<IMesDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch(`/api/historial-mensual/${params.año}/${params.mes}`)
      .then((resp) => {
        if (!resp.ok) throw new Error('Error al cargar el detalle del mes');
        return resp.json();
      })
      .then(setDetalle)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setCargando(false));
  }, [params.año, params.mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>;
  }

  if (cargando || !detalle) return <div>Cargando...</div>;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/historial-mensual?año=${detalle.año}`} className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> Volver al historial
        </Link>
        <h1 className="text-3xl font-bold mt-2">{detalle.etiqueta}</h1>
        <p className="text-gray-600 mt-1">{detalle.rangoTexto}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} /> Ingresos
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-900">{formatearMoneda(detalle.ingresos)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" strokeWidth={1.75} /> Gastos fijos
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-900">{formatearMoneda(detalle.gastosFijos)}</p>
          {detalle.gastosFijosPendiente > 0 && (
            <p className="text-[11px] text-amber-600">+{formatearMoneda(detalle.gastosFijosPendiente)} pendiente</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.75} /> Gastos variables
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-900">{formatearMoneda(detalle.gastosVariables)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <PiggyBank className="w-3.5 h-3.5" strokeWidth={1.75} /> Ahorro
          </p>
          <p className="text-base sm:text-lg font-bold text-gray-900">{formatearMoneda(detalle.ahorroDelMes)}</p>
          {detalle.ahorroDelMesPendiente > 0 && (
            <p className="text-[11px] text-amber-600">+{formatearMoneda(detalle.ahorroDelMesPendiente)} pendiente</p>
          )}
        </div>
      </div>

      <DetalleMovimientos etiqueta={detalle.etiqueta} movimientos={detalle.movimientos} onActualizar={cargar} />

      {(detalle.comprasTarjeta.length > 0 || detalle.pagosTarjeta.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <CreditCard className="w-5 h-5" strokeWidth={1.75} /> Tarjeta de crédito
          </h2>
          <p className="text-xs text-gray-500 mb-4">Compras y pagos de tarjeta registrados en este mes.</p>

          <div className="space-y-5">
            {detalle.comprasTarjeta.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Compras</p>
                <ul className="divide-y divide-gray-100">
                  {detalle.comprasTarjeta.map((c) => (
                    <li key={c.id} className="py-2 flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.categoriaColor ?? '#e34948' }}
                      />
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-900">
                        {c.nombre}
                        <span className="text-xs text-gray-400"> · {c.tarjetaNombre}</span>
                        {c.numeroMeses && <span className="text-xs text-gray-400"> · {c.numeroMeses} MSI</span>}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatearFecha(c.fecha)}</span>
                      <span className="text-sm font-semibold flex-shrink-0 tabular-nums text-red-600">
                        {formatearMoneda(c.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detalle.pagosTarjeta.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pagos</p>
                <ul className="divide-y divide-gray-100">
                  {detalle.pagosTarjeta.map((p) => (
                    <li key={p.id} className="py-2 flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-500" />
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-900">
                        {p.concepto || 'Pago a la tarjeta'}
                        <span className="text-xs text-gray-400"> · {p.tarjetaNombre}</span>
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatearFecha(p.fecha)}</span>
                      <span className="text-sm font-semibold flex-shrink-0 tabular-nums text-green-600">
                        {formatearMoneda(p.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
