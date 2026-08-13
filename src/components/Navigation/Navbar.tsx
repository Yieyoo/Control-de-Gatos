// src/components/Navigation/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/', label: 'Dashboard', icono: '📊' },
  { href: '/ingresos', label: 'Ingresos', icono: '📈' },
  { href: '/ahorros', label: 'Ahorros', icono: '🏦' },
  { href: '/gastos', label: 'Gastos', icono: '💸' },
  { href: '/movimientos', label: 'Movimientos Programados', icono: '⏰' },
  { href: '/historial', label: 'Historial', icono: '📜' },
  { href: '/categorias', label: 'Categorías', icono: '🏷️' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0 text-lg sm:text-xl font-bold text-blue-600">
            💵 Control de Gastos
          </Link>

          <div className="hidden md:flex space-x-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className="mr-1">{item.icono}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
