// src/components/Navigation/Navbar.tsx
'use client';

import { useState } from 'react';
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
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex-shrink-0 text-lg sm:text-xl font-bold text-blue-600"
            onClick={() => setMenuAbierto(false)}
          >
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

          {/* Botón hamburguesa (solo móvil) */}
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Menú móvil desplegable */}
        {menuAbierto && (
          <div className="md:hidden pb-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuAbierto(false)}
                  className={`
                    block px-3 py-2 rounded-md text-base font-medium transition-colors
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
        )}
      </div>
    </nav>
  );
}
