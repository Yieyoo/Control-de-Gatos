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
    <nav className="bg-slate-900 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">📊</span>
            <span className="text-base font-semibold text-white truncate">Control de Gastos</span>
          </Link>

          <span className="flex-shrink-0 text-xs font-medium text-white/60 whitespace-nowrap">
            {fechaHoy}
          </span>
        </div>

        <div className="hidden md:flex items-center flex-wrap gap-1 pb-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}
                `}
              >
                <span className="mr-1">{item.icono}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={cerrarSesion}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white/50 hover:bg-white/10 hover:text-red-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </nav>
  );
}
