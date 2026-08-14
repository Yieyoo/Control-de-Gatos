// src/app/historial/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { IMovimientoAhorro, IPagoTarjeta } from '@/types';
import { formatearMoneda, formatearDiaMes } from '@/utils/calculos';

type Filtro = 'todos' | 'ahorros' | 'tarjeta';

interface ItemHistorial {
  id: string;
  fecha: string;
  titulo: string;
  subtitulo: string;
  cantidad: number;
  signo: '+' | '-';
  color: string;
  origen: 'ahorros' | 'tarjeta';
}

export default function HistorialPage() {
  const [movimientos, setMovimientos] = useState<IMovimientoAhorro[]>([]);
  const [pagos, setPagos] = useState<IPagoTarjeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    Promise.all([
      fetch('/api/ahorros/movimientos').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/tarjetas/pagos').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([mov, pag]) => {
        setMovimientos(mov);
        setPagos(pag);
      })
      .finally(() => setCargando(false));
  }, []);

  const items: ItemHistorial[] = [
    ...movimientos.map((m) => ({
      id: `ahorro-${m.id}`,
      fecha: m.fecha,
      titulo: m.concepto,
      subtitulo: `${m.tipo === 'deposito' ? 'Depósito' : 'Retiro'} • ${m.ahorro?.nombre ?? 'Ahorro'}`,
      cantidad: m.cantidad,
      signo: (m.tipo === 'deposito' ? '+' : '-') as '+' | '-',
      color: m.tipo === 'deposito' ? 'text-green-600' : 'text-red-600',
      origen: 'ahorros' as const,
    })),
    ...pagos.map((p) => ({
      id: `pago-${p.id}`,
      fecha: p.fecha,
      titulo: p.concepto || 'Pago a la tarjeta',
      subtitulo: `Pago de tarjeta • ${p.tarjeta?.nombre ?? 'Tarjeta'}`,
      cantidad: p.cantidad,
      signo: '-' as const,
      color: 'text-green-600',
      origen: 'tarjeta' as const,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const itemsFiltrados = items.filter((i) => filtro === 'todos' || i.origen === filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📜 Historial de Movimientos</h1>
        <p className="text-gray-600 mt-1">Depósitos y retiros de ahorro, y pagos a tarjeta de crédito</p>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit">
        {([
          ['todos', 'Todos'],
          ['ahorros', 'Ahorros'],
          ['tarjeta', 'Tarjeta'],
        ] as const).map(([valor, etiqueta]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filtro === valor ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <div>Cargando...</div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            {filtro === 'todos'
              ? 'Todavía no tienes movimientos registrados.'
              : filtro === 'ahorros'
              ? 'Todavía no tienes depósitos ni retiros de ahorro.'
              : 'Todavía no tienes pagos de tarjeta registrados.'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Se registran desde el botón &quot;Registrar movimiento&quot; en Ahorros y &quot;Registrar pago&quot; en Tarjeta de Crédito.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {itemsFiltrados.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{item.titulo}</p>
                <p className="text-xs text-gray-500 truncate">
                  {item.subtitulo} • {formatearDiaMes(new Date(item.fecha))}
                </p>
              </div>
              <p className={`font-bold whitespace-nowrap flex-shrink-0 ${item.color}`}>
                {item.signo}
                {formatearMoneda(item.cantidad)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
