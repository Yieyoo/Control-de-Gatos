// src/components/Navigation/BottomNav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cerrarSesion } from '@/lib/cerrarSesion';

const quickAddItems = [
  { href: '/ingresos?nuevo=1', label: 'Registrar ingreso', icono: '💰' },
  { href: '/gastos?nuevo=1', label: 'Registrar gasto', icono: '💸' },
  { href: '/ahorros?nuevo=1', label: 'Registrar ahorro', icono: '🏦' },
];

const verItems = [
  { href: '/ingresos', label: 'Ingresos', icono: '📈' },
  { href: '/gastos', label: 'Gastos', icono: '💸' },
  { href: '/ahorros', label: 'Ahorros', icono: '🏦' },
  { href: '/tarjetas', label: 'Tarjeta de Crédito', icono: '💳' },
  { href: '/terceros', label: 'Dinero de Terceros', icono: '🤝' },
  { href: '/movimientos', label: 'Movimientos Programados', icono: '⏰' },
  { href: '/historial', label: 'Historial', icono: '📜' },
  { href: '/categorias', label: 'Categorías', icono: '🏷️' },
];

function TabLink({ href, label, icono, activo }: { href: string; label: string; icono: string; activo: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs font-medium ${
        activo ? 'text-blue-600' : 'text-gray-500'
      }`}
    >
      <span className="text-xl leading-none">{icono}</span>
      {label}
    </Link>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl p-4 pb-6 space-y-1 shadow-lg">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
        {children}
      </div>
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (pathname === '/login') return null;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="flex items-center">
          <TabLink href="/" label="Inicio" icono="🏠" activo={pathname === '/'} />

          <div className="flex-1 flex justify-center">
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              aria-label="Agregar"
              className="-mt-6 w-14 h-14 rounded-full bg-blue-600 text-white text-2xl flex items-center justify-center shadow-lg active:bg-blue-700"
            >
              +
            </button>
          </div>

          <TabLink
            href="/historial-mensual"
            label="Meses"
            icono="🗓️"
            activo={pathname === '/historial-mensual'}
          />
        </div>
      </nav>

      {menuAbierto && (
        <Sheet onClose={() => setMenuAbierto(false)}>
          <p className="text-sm font-semibold text-gray-500 px-2 pb-2">Agregar</p>
          {quickAddItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuAbierto(false)}
              className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-gray-800 font-medium"
            >
              <span className="text-xl">{item.icono}</span>
              {item.label}
            </Link>
          ))}

          <p className="text-sm font-semibold text-gray-500 px-2 pt-3 pb-2 border-t border-gray-100 mt-2">Ver</p>
          {verItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuAbierto(false)}
              className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-gray-800 font-medium"
            >
              <span className="text-xl">{item.icono}</span>
              {item.label}
            </Link>
          ))}

          <div className="border-t border-gray-100 mt-2 pt-2">
            <button
              type="button"
              onClick={cerrarSesion}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-red-50 text-red-600 font-medium"
            >
              <span className="text-xl">🚪</span>
              Cerrar sesión
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
