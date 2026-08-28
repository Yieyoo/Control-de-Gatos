// src/components/Navigation/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cerrarSesion } from '@/lib/cerrarSesion';
import { formatearDiaMes, hoyMexico } from '@/utils/calculos';
import {
  Wallet,
  LayoutDashboard,
  TrendingUp,
  Landmark,
  Receipt,
  CreditCard,
  Handshake,
  Clock,
  History,
  CalendarDays,
  Tag,
  Scale,
  type LucideIcon,
} from 'lucide-react';

const menuItems: { href: string; label: string; icono: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icono: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icono: TrendingUp },
  { href: '/ahorros', label: 'Ahorros', icono: Landmark },
  { href: '/gastos', label: 'Gastos', icono: Receipt },
  { href: '/tarjetas', label: 'Tarjeta de Crédito', icono: CreditCard },
  { href: '/terceros', label: 'Dinero de Terceros', icono: Handshake },
  { href: '/movimientos', label: 'Movimientos Programados', icono: Clock },
  { href: '/historial', label: 'Historial', icono: History },
  { href: '/historial-mensual', label: 'Historial Mensual', icono: CalendarDays },
  { href: '/categorias', label: 'Categorías', icono: Tag },
  { href: '/porcentajes', label: '% destinado a cada cosa', icono: Scale },
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
            <Wallet className="w-5 h-5 flex-shrink-0 text-white" strokeWidth={1.75} />
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
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}
                `}
              >
                <item.icono className="w-4 h-4" strokeWidth={1.75} />
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
