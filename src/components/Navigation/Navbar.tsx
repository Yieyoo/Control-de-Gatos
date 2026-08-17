// src/components/Navigation/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cerrarSesion } from '@/lib/cerrarSesion';
import { formatearDiaMes, hoyMexico } from '@/utils/calculos';

const menuItems = [
  { href: '/', label: 'Dashboard', icono: '📊' },
  { href: '/ingresos', label: 'Ingresos', icono: '📈' },
  { href: '/ahorros', label: 'Ahorros', icono: '🏦' },
  { href: '/gastos', label: 'Gastos', icono: '💸' },
  { href: '/tarjetas', label: 'Tarjeta de Crédito', icono: '💳' },
  { href: '/terceros', label: 'Dinero de Terceros', icono: '🤝' },
  { href: '/movimientos', label: 'Movimientos Programados', icono: '⏰' },
  { href: '/historial', label: 'Historial', icono: '📜' },
  { href: '/historial-mensual', label: 'Historial Mensual', icono: '🗓️' },
  { href: '/categorias', label: 'Categorías', icono: '🏷️' },
];

export function Navbar() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const fechaHoy = formatearDiaMes(hoyMexico());

  return (
    <nav className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-emerald-800 rounded-b-3xl shadow-lg sticky top-0 z-10">
      {/* Decorativo: silueta tipo "skyline" de barras, muy sutil */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-1.5 px-6 opacity-10">
        {[40, 65, 30, 80, 50, 70, 35, 60, 45].map((alto, i) => (
          <div key={i} className="flex-1 bg-white rounded-t-sm" style={{ height: `${alto}%`, maxHeight: '90px' }} />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-4 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center text-xl sm:text-2xl shadow">
              📊
            </span>
            <span className="min-w-0">
              <span className="block text-lg sm:text-xl font-bold text-white leading-tight truncate">
                Control de Gastos
              </span>
              <span className="block text-xs text-white/60 leading-tight truncate">
                Organiza hoy, disfruta mañana
              </span>
              <span className="block w-9 h-1 rounded-full bg-emerald-400 mt-1.5" />
            </span>
          </Link>

          <span className="flex-shrink-0 flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap">
            <span>📅</span>
            {fechaHoy}
          </span>
        </div>

        <div className="hidden md:flex items-center flex-wrap gap-1 mt-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}
                `}
              >
                <span className="mr-1">{item.icono}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={cerrarSesion}
            className="px-3 py-2 rounded-md text-sm font-medium text-white/60 hover:bg-white/10 hover:text-red-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </nav>
  );
}
