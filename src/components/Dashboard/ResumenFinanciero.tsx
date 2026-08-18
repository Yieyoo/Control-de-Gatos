'use client';

import { useEffect, useState } from 'react';
import { formatearMoneda, formatearDiaMes, hoyMexico, cicloTarjetaActual, ocurrenciasDeGastoEnRangos } from '@/utils/calculos';
import type { IDashboardResumen, IResumenPeriodo, ICompraTarjeta, IPagoTarjeta, IGastoDomiciliado } from '@/types';

type Vista = 'mes' | 'quincena1' | 'quincena2';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
  vista: Vista;
  onCambiarVista: (vista: Vista) => void;
  onSaldoActualizado: () => void;
}

const PIN_AHORRO = '1296';
const CORTE_1 = 10;

interface CargoDomiciliadoResumen {
  nombre: string;
  monto: number;
  fecha: Date | null;
  pagadoAdelantado: boolean;
}

function DeudaTarjetasExpandible({ tarjetas }: { tarjetas: IDashboardResumen['deudaTarjetas'] }) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);
  const [pagos, setPagos] = useState<IPagoTarjeta[]>([]);
  const [gastosDomiciliados, setGastosDomiciliados] = useState<IGastoDomiciliado[]>([]);

  useEffect(() => {
    if (!expandido || cargado) return;
    Promise.all([
      fetch('/api/tarjetas/compras').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/tarjetas/pagos').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/gastos/domiciliados').then((r) => (r.ok ? r.json() : [])),
    ]).then(([c, p, g]) => {
      setCompras(c);
      setPagos(p);
      setGastosDomiciliados(g);
      setCargado(true);
    });
  }, [expandido, cargado]);

  if (tarjetas.length === 0) return null;

  const total = tarjetas.reduce((s, t) => s + t.debe, 0);
  const hoy = hoyMexico();

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span className="text-lg">💳</span> Deuda de tarjetas
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold text-red-600">{formatearMoneda(total)}</span>
          <span className="text-gray-400 text-xs">{expandido ? '▲' : '▼'}</span>
        </span>
      </button>

      {expandido && (
        <div className="mt-3 space-y-4">
          {!cargado ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : (
            tarjetas.map((t) => {
              const cicloActual = cicloTarjetaActual(hoy, t.diaCorte);
              const pagosTarjeta = pagos.filter((p) => p.tarjetaId === t.id);
              const comprasTarjeta = compras
                .filter((c) => c.tarjetaId === t.id)
                .map((c) => {
                  const montoPagado = pagos
                    .filter((p) => p.compraTarjetaId === c.id)
                    .reduce((s, p) => s + p.cantidad, 0);
                  const neto = c.cantidad - (c.devoluciones ?? []).reduce((s, d) => s + d.cantidad, 0);
                  const pagada = montoPagado >= neto - 0.01;
                  const saldoPendiente = Math.max(0, neto - montoPagado);
                  return { compra: c, montoPagado, neto, pagada, saldoPendiente };
                });
              const cargosDomiciliados: CargoDomiciliadoResumen[] = gastosDomiciliados
                .filter((g) => g.activo && g.tarjetaId === t.id)
                .map((g) => {
                  const ocurrencias = ocurrenciasDeGastoEnRangos(g, [cicloActual], CORTE_1);
                  const fechaMasReciente = ocurrencias.reduce<Date | null>(
                    (max, oc) => (!max || oc.fecha > max ? oc.fecha : max),
                    null
                  );
                  const monto = ocurrencias.reduce((s, oc) => s + oc.cantidad, 0);
                  const pagadoAdelantado = !!(
                    g.pagadoAdelantadoHasta &&
                    fechaMasReciente &&
                    new Date(g.pagadoAdelantadoHasta) >= fechaMasReciente
                  );
                  return { nombre: g.nombre, monto, fecha: fechaMasReciente, pagadoAdelantado };
                })
                .filter((c) => c.fecha !== null);

              if (comprasTarjeta.length === 0 && cargosDomiciliados.length === 0 && pagosTarjeta.length === 0) {
                return null;
              }

              return (
                <div key={t.id}>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">
                    {t.nombre} · debes {formatearMoneda(t.debe)}
                  </p>
                  <ul className="space-y-1">
                    {comprasTarjeta.map(({ compra: c, montoPagado, neto, pagada, saldoPendiente }) => (
                      <li key={`compra-${c.id}`} className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            pagada ? 'text-gray-400 line-through' : 'text-gray-700'
                          }`}
                        >
                          {c.nombre}
                          {!pagada && montoPagado > 0 && (
                            <span className="text-[10px] text-green-600 ml-1">
                              (pagado {formatearMoneda(montoPagado)})
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatearDiaMes(new Date(c.fecha))}</span>
                        <span
                          className={`font-semibold flex-shrink-0 ${pagada ? 'text-gray-400' : 'text-red-600'}`}
                        >
                          {formatearMoneda(pagada ? neto : saldoPendiente)}
                        </span>
                      </li>
                    ))}
                    {cargosDomiciliados.map((c, i) => (
                      <li key={`cargo-${i}`} className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            c.pagadoAdelantado ? 'text-gray-400 line-through' : 'text-gray-700'
                          }`}
                        >
                          {c.nombre}
                        </span>
                        <span
                          className={`font-semibold flex-shrink-0 ${
                            c.pagadoAdelantado ? 'text-gray-400' : 'text-red-600'
                          }`}
                        >
                          {formatearMoneda(c.monto)}
                        </span>
                      </li>
                    ))}
                    {pagosTarjeta.map((p) => (
                      <li key={`pago-${p.id}`} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-gray-700">{p.concepto || 'Pago'}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatearDiaMes(new Date(p.fecha))}</span>
                        <span className="font-semibold text-green-600 flex-shrink-0">-{formatearMoneda(p.cantidad)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          <p className="text-[11px] text-gray-400">
            En rojo lo que falta pagar (compras y cargos pendientes), en gris lo que ya marcaste como pagado, en verde tus pagos.
          </p>
        </div>
      )}
    </div>
  );
}

export function ResumenFinanciero({ resumen, vista, onCambiarVista, onSaldoActualizado }: ResumenFinancieroProps) {
  // Ahorro total empieza oculto siempre que se abre la app; solo se destapa con el PIN.
  const [ocultarAhorro, setOcultarAhorro] = useState(true);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinIncorrecto, setPinIncorrecto] = useState(false);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [valorSaldo, setValorSaldo] = useState('');
  const p: IResumenPeriodo = resumen.periodos[vista];

  const iniciarEdicionSaldo = () => {
    setValorSaldo(String(p.dineroDisponible));
    setEditandoSaldo(true);
  };

  const handleGuardarSaldo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/configuracion/saldoDisponibleManual', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: parseFloat(valorSaldo || '0') }),
      });
      if (!resp.ok) throw new Error('Error al actualizar saldo');
      setEditandoSaldo(false);
      onSaldoActualizado();
    } catch (err) {
      console.error(err);
    }
  };

  const abrirPromptPin = () => {
    setPin('');
    setPinIncorrecto(false);
    setPidiendoPin(true);
  };

  const ocultarDeNuevo = () => {
    setOcultarAhorro(true);
    setPidiendoPin(false);
    setPin('');
  };

  const handleSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_AHORRO) {
      setOcultarAhorro(false);
      setPidiendoPin(false);
      setPin('');
      setPinIncorrecto(false);
    } else {
      setPinIncorrecto(true);
      setPin('');
    }
  };

  const tarjetas = [
    {
      titulo: 'Ingresos',
      cantidad: p.ingresos,
      badge: 'bg-blue-100',
      icono: '📈',
    },
    {
      titulo: 'Ahorro',
      cantidad: p.ahorroDelMes,
      subtitulo: p.ahorroDelMesPendiente > 0 ? `+${formatearMoneda(p.ahorroDelMesPendiente)} pendiente` : undefined,
      badge: 'bg-violet-100',
      icono: '🐷',
    },
    {
      titulo: 'Gastos fijos',
      cantidad: p.gastosFijos,
      subtitulo: p.gastosFijosPendiente > 0 ? `+${formatearMoneda(p.gastosFijosPendiente)} pendiente` : undefined,
      badge: 'bg-orange-100',
      icono: '📄',
    },
    {
      titulo: 'Gastos variables',
      cantidad: p.gastosVariables,
      badge: 'bg-pink-100',
      icono: '🛒',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Resumen</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          {(['quincena1', 'quincena2', 'mes'] as const).map((opcion) => (
            <button
              key={opcion}
              onClick={() => onCambiarVista(opcion)}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                vista === opcion ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {opcion === 'mes' ? 'Mes' : opcion === 'quincena1' ? 'Actual' : 'Próxima'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">{p.rangoTexto}</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.titulo} className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${tarjeta.badge} flex items-center justify-center text-lg flex-shrink-0`}>
              {tarjeta.icono}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-tight">{tarjeta.titulo}</p>
              <p className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                {formatearMoneda(tarjeta.cantidad)}
              </p>
              {tarjeta.subtitulo && (
                <p className="text-xs text-amber-600 leading-tight">{tarjeta.subtitulo}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💵</span>
              <p className="text-xs font-medium text-green-800">Dinero disponible</p>
            </div>
            {!editandoSaldo && (
              <button
                type="button"
                onClick={iniciarEdicionSaldo}
                aria-label="Editar dinero disponible"
                className="text-green-700/60 hover:text-green-700"
              >
                ✏️
              </button>
            )}
          </div>

          {editandoSaldo ? (
            <form onSubmit={handleGuardarSaldo} className="space-y-1.5">
              <input
                type="number"
                step="0.01"
                autoFocus
                value={valorSaldo}
                onChange={(e) => setValorSaldo(e.target.value)}
                className="w-full border border-green-300 rounded px-2 py-1.5 text-base font-semibold"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white text-sm font-medium py-1 rounded hover:bg-green-700"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoSaldo(false)}
                  className="flex-shrink-0 text-gray-500 hover:text-gray-700 text-sm px-2"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[11px] text-green-800/60 leading-tight">
                Ponlo igual a tu saldo real de banco cuando lo revises
              </p>
            </form>
          ) : (
            <>
              <p className="text-base sm:text-xl font-bold text-green-700 leading-tight">
                {formatearMoneda(p.dineroDisponible)}
              </p>
              <div className="mt-2 pt-2 border-t border-green-200">
                <p className="text-xs font-medium text-green-800">Dinero real</p>
                <p
                  className={`text-sm sm:text-base font-bold leading-tight ${
                    p.dineroReal < 0 ? 'text-red-600' : 'text-green-700'
                  }`}
                >
                  {formatearMoneda(p.dineroReal)}
                </p>
                <p className="text-[11px] text-green-800/60 leading-tight">con pendientes ya liquidados</p>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <p className="text-xs font-medium text-blue-800">Ahorro e inversión</p>
            </div>
            <button
              type="button"
              onClick={ocultarAhorro ? abrirPromptPin : ocultarDeNuevo}
              aria-label={ocultarAhorro ? 'Mostrar ahorro' : 'Ocultar ahorro'}
              className="text-blue-700/60 hover:text-blue-700"
            >
              {ocultarAhorro ? '🙈' : '👁️'}
            </button>
          </div>

          {pidiendoPin ? (
            <form onSubmit={handleSubmitPin} className="mt-1">
              <div className="flex gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinIncorrecto(false);
                  }}
                  className={`min-w-0 flex-1 border rounded px-2 py-1 text-sm ${
                    pinIncorrecto ? 'border-red-400' : 'border-blue-300'
                  }`}
                />
                <button
                  type="submit"
                  className="flex-shrink-0 bg-blue-600 text-white text-sm font-medium px-2.5 rounded hover:bg-blue-700"
                >
                  ✓
                </button>
              </div>
              {pinIncorrecto && <p className="text-[11px] text-red-600 mt-1">PIN incorrecto</p>}
            </form>
          ) : (
            <>
              <p className="text-base sm:text-xl font-bold text-blue-700 leading-tight">
                {ocultarAhorro ? '•••••••' : formatearMoneda(resumen.ahorroTotal)}
              </p>
              {resumen.ahorrosLugares.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200 space-y-0.5">
                  {resumen.ahorrosLugares.map((ahorro) => (
                    <div key={ahorro.id} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-blue-800/70 truncate">{ahorro.nombre}</span>
                      <span className="text-[11px] font-semibold text-blue-800 flex-shrink-0">
                        {ocultarAhorro ? '•••' : formatearMoneda(ahorro.saldoActual)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <DeudaTarjetasExpandible tarjetas={resumen.deudaTarjetas} />
    </div>
  );
}
