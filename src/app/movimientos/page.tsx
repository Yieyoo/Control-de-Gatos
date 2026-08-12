// src/app/movimientos/page.tsx
'use client';

export default function MovimientosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⏰ Movimientos Programados</h1>
        <p className="text-gray-600 mt-1">Gestiona tus gastos y ahorros automáticos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">💳 Gastos Domiciliados</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800 text-sm">
            En construcción
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">💰 Ahorros Domiciliados</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800 text-sm">
            En construcción
          </div>
        </div>
      </div>
    </div>
  );
}
