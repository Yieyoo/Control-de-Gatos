'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResumenFinanciero } from '@/components/Dashboard/ResumenFinanciero';
import { DetalleMovimientos } from '@/components/Dashboard/DetalleMovimientos';
import { DeudaTarjetas } from '@/components/Dashboard/DeudaTarjetas';
import { GastosPorCategoria } from '@/components/Dashboard/GastosPorCategoria';
import { ProximosMovimientos } from '@/components/Dashboard/ProximosMovimientos';
import type { IDashboardResumen } from '@/types';

export default function Home() {
  const [resumen, setResumen] = useState<IDashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'mes' | 'quincena1' | 'quincena2'>('quincena1');

  useEffect(() => {
    const cargarResumen = async () => {
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
    };

    cargarResumen();
  }, []);

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

  const fechaHoyTexto = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const fechaHoy = fechaHoyTexto.charAt(0).toUpperCase() + fechaHoyTexto.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">📊 Dashboard</h1>
        <p className="text-gray-600">{fechaHoy}</p>
      </div>

      <ResumenFinanciero resumen={resumen} vista={vista} onCambiarVista={setVista} />
      {vista !== 'mes' && (
        <DetalleMovimientos
          etiqueta={resumen.periodos[vista].etiqueta}
          movimientos={resumen.periodos[vista].movimientos}
        />
      )}
      <DeudaTarjetas tarjetas={resumen.deudaTarjetas} />
      <GastosPorCategoria categorias={resumen.gastosPorCategoria} />
      <ProximosMovimientos movimientos={resumen.proximosMovimientos} />

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/gastos"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📝 Registrar Gasto</h3>
          <p className="text-gray-600 text-sm">Agrega un nuevo gasto a tu registro</p>
        </Link>
        <Link
          href="/ingresos"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">💰 Registrar Ingreso</h3>
          <p className="text-gray-600 text-sm">Registra un nuevo ingreso o pago recibido</p>
        </Link>
        <Link
          href="/ahorros"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🏦 Ahorros</h3>
          <p className="text-gray-600 text-sm">Administra tus cuentas de ahorro</p>
        </Link>
      </div>
    </div>
  );
}
