'use client';

import { useCallback, useEffect, useState } from 'react';
import { ResumenFinanciero } from '@/components/Dashboard/ResumenFinanciero';
import { PorcentajeDestino } from '@/components/Dashboard/PorcentajeDestino';
import { DetalleMovimientos } from '@/components/Dashboard/DetalleMovimientos';
import { GastosPorCategoria } from '@/components/Dashboard/GastosPorCategoria';
import { ProximosMovimientos } from '@/components/Dashboard/ProximosMovimientos';
import type { IDashboardResumen } from '@/types';

export default function Home() {
  const [resumen, setResumen] = useState<IDashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'mes' | 'quincena1' | 'quincena2'>('quincena1');

  const cargarResumen = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/dashboard');
      if (!respuesta.ok) {
        throw new Error('Error al cargar el resumen');
      }
      const datos = await respuesta.json();
      setResumen(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <h2 className="font-bold">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!resumen) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
        <p>No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResumenFinanciero
        resumen={resumen}
        vista={vista}
        onCambiarVista={setVista}
        onSaldoActualizado={cargarResumen}
      />
      <PorcentajeDestino datos={resumen.periodos[vista].porcentajeDestino} />
      {vista !== 'mes' && (
        <DetalleMovimientos
          etiqueta={resumen.periodos[vista].etiqueta}
          movimientos={resumen.periodos[vista].movimientos}
          onAhorroActualizado={cargarResumen}
        />
      )}
      <GastosPorCategoria categorias={resumen.gastosPorCategoria} />
      <ProximosMovimientos movimientos={resumen.proximosMovimientos} />
    </div>
  );
}
