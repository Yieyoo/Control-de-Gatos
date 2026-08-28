// src/app/porcentajes/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatearMoneda } from '@/utils/calculos';
import type { IIngreso, IPorcentajesMeta } from '@/types';
import { Scale, Home, Gamepad2, PiggyBank, Check, type LucideIcon } from 'lucide-react';

const DEFECTO: IPorcentajesMeta = { necesidades: 50, gustos: 20, ahorro: 30 };

const RUBROS: { clave: keyof IPorcentajesMeta; etiqueta: string; icono: LucideIcon; textoColor: string }[] = [
  { clave: 'necesidades', etiqueta: 'Necesidades', icono: Home, textoColor: 'text-blue-700' },
  { clave: 'gustos', etiqueta: 'Gustos', icono: Gamepad2, textoColor: 'text-purple-700' },
  { clave: 'ahorro', etiqueta: 'Ahorro', icono: PiggyBank, textoColor: 'text-green-700' },
];

export default function PorcentajesPage() {
  const [valores, setValores] = useState<IPorcentajesMeta>(DEFECTO);
  const [ingresoQuincenal, setIngresoQuincenal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/configuracion/porcentajes_destino').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/ingresos').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([config, ingresos]: [{ valor: string | null } | null, IIngreso[]]) => {
        if (config?.valor) {
          try {
            const parsed = JSON.parse(config.valor);
            if (
              typeof parsed.necesidades === 'number' &&
              typeof parsed.gustos === 'number' &&
              typeof parsed.ahorro === 'number'
            ) {
              setValores(parsed);
            }
          } catch {
            // valor guardado inválido, se queda el default
          }
        }

        const quincenal = ingresos
          .filter((i) => i.activo)
          .reduce((sum, i) => {
            if (i.frecuencia === 'quincenal') return sum + i.cantidad;
            if (i.frecuencia === 'mensual') return sum + i.cantidad / 2;
            return sum; // "unico" no es parte del ingreso recurrente que se reparte
          }, 0);
        setIngresoQuincenal(quincenal);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setCargando(false));
  }, []);

  const suma = valores.necesidades + valores.gustos + valores.ahorro;
  const sumaOk = Math.abs(suma - 100) < 0.01;

  const handleCambiar = (clave: keyof IPorcentajesMeta, texto: string) => {
    const num = texto === '' ? 0 : parseFloat(texto);
    setGuardado(false);
    setValores((v) => ({ ...v, [clave]: isNaN(num) ? 0 : num }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch('/api/configuracion/porcentajes_destino', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: JSON.stringify(valores) }),
      });
      if (!resp.ok) throw new Error('Error al guardar');
      setGuardado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const ingresoMensual = ingresoQuincenal * 2;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Scale className="w-7 h-7" strokeWidth={1.75} /> % destinado a cada cosa
        </h1>
        <p className="text-gray-600 mt-1">
          Define qué porcentaje de tu ingreso quieres destinar a necesidades, gustos y ahorro. Esto es lo que se
          compara contra tu meta en el Dashboard.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {RUBROS.map((r) => (
          <div key={r.clave} className="flex items-center gap-3">
            <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
              <r.icono className={`w-4 h-4 ${r.textoColor}`} strokeWidth={1.75} />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-700">{r.etiqueta}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={valores[r.clave]}
                onChange={(e) => handleCambiar(r.clave, e.target.value)}
                className="w-20 border border-gray-300 rounded px-2 py-1.5 text-right"
              />
              <span className="text-gray-500 text-sm">%</span>
            </div>
          </div>
        ))}

        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
            sumaOk ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <span>Suma total</span>
          <span>{suma}%{!sumaOk && ' — debe sumar 100%'}</span>
        </div>

        <button
          type="button"
          onClick={handleGuardar}
          disabled={!sumaOk || guardando}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        {guardado && (
          <p className="text-sm text-green-600 text-center flex items-center justify-center gap-1">
            <Check className="w-4 h-4" strokeWidth={2} /> Guardado
          </p>
        )}
      </div>

      {ingresoQuincenal > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-500">Con esos porcentajes, cuánto tienes para gastar:</p>
          {[
            { etiqueta: 'Por quincena', ingreso: ingresoQuincenal },
            { etiqueta: 'Por mes', ingreso: ingresoMensual },
          ].map(({ etiqueta, ingreso }) => (
            <div key={etiqueta} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-900">{etiqueta}</p>
                <p className="text-sm text-gray-500">Ingreso {formatearMoneda(ingreso)}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {RUBROS.map((r) => (
                  <div key={r.clave} className="text-center">
                    <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <r.icono className="w-3.5 h-3.5" strokeWidth={1.75} /> {r.etiqueta}
                    </p>
                    <p className={`text-base font-bold mt-0.5 ${r.textoColor}`}>
                      {formatearMoneda((ingreso * valores[r.clave]) / 100)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {ingresoQuincenal === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Todavía no tienes un ingreso quincenal o mensual activo registrado, así que no se pueden mostrar los
          totales en pesos -- pero el % se guarda igual.
        </div>
      )}
    </div>
  );
}
