// src/app/historial/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { IMovimientoAhorro, IPagoTarjeta, IGastoVariable, ICompraTarjeta } from '@/types';
import { formatearMoneda, formatearDiaMes } from '@/utils/calculos';
import { History } from 'lucide-react';

type Filtro = 'todos' | 'gastos' | 'ahorros' | 'tarjeta';

interface ItemHistorial {
  id: string;
  fecha: string;
  titulo: string;
  subtitulo: string;
  cantidad: number;
  signo: '+' | '-';
  color: string;
  origen: 'gastos' | 'ahorros' | 'tarjeta';
}

const ETIQUETA_FUENTE: Record<string, string> = {
  disponible: 'disponible',
  ahorro: 'ahorro',
  tercero: 'tercero',
};

export default function HistorialPage() {
  const [movimientos, setMovimientos] = useState<IMovimientoAhorro[]>([]);
  const [pagos, setPagos] = useState<IPagoTarjeta[]>([]);
  const [gastos, setGastos] = useState<IGastoVariable[]>([]);
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    Promise.all([
      fetch('/api/ahorros/movimientos').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/tarjetas/pagos').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/gastos/variables').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/tarjetas/compras').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([mov, pag, gas, com]) => {
        setMovimientos(mov);
        setPagos(pag);
        setGastos(gas);
        setCompras(com);
      })
      .finally(() => setCargando(false));
  }, []);

  const netoDe = (item: { cantidad: number; devoluciones?: { cantidad: number }[] }) =>
    item.cantidad - (item.devoluciones ?? []).reduce((s, d) => s + d.cantidad, 0);

  const items: ItemHistorial[] = [
    // Los movimientos de ahorro que ya vienen de un gasto/pago (origen "pago_gasto"/
    // "pago_tarjeta") no se listan aparte para no duplicar esa misma salida de dinero.
    ...movimientos
      .filter((m) => m.origen !== 'pago_gasto' && m.origen !== 'pago_tarjeta')
      .map((m) => ({
        id: `ahorro-${m.id}`,
        fecha: m.fecha,
        titulo: m.concepto,
        subtitulo: `${m.tipo === 'deposito' ? 'Depósito' : 'Retiro'} • ${m.ahorro?.nombre ?? 'Ahorro'}${m.origen === 'domiciliado' ? ' • automático' : ''}`,
        cantidad: m.cantidad,
        signo: (m.tipo === 'deposito' ? '+' : '-') as '+' | '-',
        color: m.tipo === 'deposito' ? 'text-green-600' : 'text-red-600',
        origen: 'ahorros' as const,
      })),
    ...pagos.map((p) => ({
      id: `pago-${p.id}`,
      fecha: p.fecha,
      titulo: p.concepto || 'Pago a la tarjeta',
      subtitulo: `Pago de tarjeta • ${p.tarjeta?.nombre ?? 'Tarjeta'} • ${ETIQUETA_FUENTE[p.fuente] ?? p.fuente}`,
      cantidad: p.cantidad,
      signo: '-' as const,
      color: 'text-green-600',
      origen: 'tarjeta' as const,
    })),
    ...gastos
      .filter((g) => g.fuente !== 'tercero')
      .map((g) => ({
        id: `gasto-${g.id}`,
        fecha: g.fecha as unknown as string,
        titulo: g.nombre,
        subtitulo: `Gasto • ${g.categoria?.nombre ?? 'Sin categoría'} • ${ETIQUETA_FUENTE[g.fuente] ?? g.fuente}${g.gastoDomiciliadoOrigenId != null ? ' • automático' : ''}`,
        cantidad: netoDe(g),
        signo: '-' as const,
        color: 'text-red-600',
        origen: 'gastos' as const,
      })),
    ...compras.map((c) => ({
      id: `compra-${c.id}`,
      fecha: c.fecha,
      titulo: c.nombre,
      subtitulo: `Compra de tarjeta • ${c.tarjeta?.nombre ?? 'Tarjeta'}${c.numeroMeses ? ` • ${c.numeroMeses} MSI` : ''}`,
      cantidad: netoDe(c),
      signo: '-' as const,
      color: 'text-red-600',
      origen: 'tarjeta' as const,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const itemsFiltrados = items.filter((i) => filtro === 'todos' || i.origen === filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="w-7 h-7" strokeWidth={1.75} /> Historial de Movimientos
        </h1>
        <p className="text-gray-600 mt-1">Todo lo que has gastado, ahorrado y pagado</p>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium w-fit flex-wrap">
        {([
          ['todos', 'Todos'],
          ['gastos', 'Gastos'],
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
          <p className="text-gray-600">Todavía no tienes movimientos registrados.</p>
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
