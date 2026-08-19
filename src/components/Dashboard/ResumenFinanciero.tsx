'use client';

import { useEffect, useState } from 'react';
import {
  formatearMoneda,
  formatearDiaMes,
  hoyMexico,
  periodoQuincenaActual,
  periodoQuincenaSiguiente,
  ocurrenciasDeGastoEnRangos,
  type RangoFechas,
} from '@/utils/calculos';
import type { IDashboardResumen, IResumenPeriodo, ICompraTarjeta, IPagoTarjeta, IGastoDomiciliado } from '@/types';

type Vista = 'mes' | 'quincena1' | 'quincena2';

interface ResumenFinancieroProps {
  resumen: IDashboardResumen;
  vista: Vista;
  onCambiarVista: (vista: Vista) => void;
}

const PIN_AHORRO = '1296';
const CORTE_1 = 10;
const CORTE_2 = 25;

interface CargoDomiciliadoResumen {
  nombre: string;
  monto: number;
  fecha: Date | null;
  pagadoAdelantado: boolean;
}

function DeudaTarjetasExpandible({
  tarjetas,
  vista,
}: {
  tarjetas: IDashboardResumen['deudaTarjetas'];
  vista: Vista;
}) {
  const [cargado, setCargado] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);
  const [pagos, setPagos] = useState<IPagoTarjeta[]>([]);
  const [gastosDomiciliados, setGastosDomiciliados] = useState<IGastoDomiciliado[]>([]);

  // Se carga siempre (no solo al expandir) porque el total de arriba también
  // depende de la quincena que se esté viendo -- necesita los cargos
  // domiciliados de una vez para calcularlo bien, esté o no expandido.
  useEffect(() => {
    if (cargado) return;
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
  }, [cargado]);

  if (tarjetas.length === 0) return null;

  const hoy = hoyMexico();
  // En "Próxima" solo interesa lo que falta pagar (rojo); en "Actual" y "Mes"
  // se ve el panorama completo (lo pagado en gris + lo pendiente en rojo).
  const soloPendientes = vista === 'quincena2';
  // Los cargos domiciliados de tarjeta (Claude, Plan Telcel, etc.) se cuentan
  // según la quincena que se esté viendo, no según el ciclo de corte de la
  // tarjeta -- así uno que cobra el día 28 solo suma a la deuda (y aparece en
  // la lista) en la quincena donde realmente cae, no antes.
  const periodoActual = periodoQuincenaActual(hoy, CORTE_1, CORTE_2);
  const periodoProximo = periodoQuincenaSiguiente(periodoActual, CORTE_1, CORTE_2);
  const rangosCargos: RangoFechas[] =
    vista === 'quincena1' ? [periodoActual] : vista === 'quincena2' ? [periodoProximo] : [periodoActual, periodoProximo];

  // Comprado/pagado siempre cuentan todo el historial (las compras y los pagos
  // no dependen de qué quincena se esté viendo); solo los cargos domiciliados
  // pendientes se acotan a `rangosCargos`. Se calcula una sola vez por tarjeta
  // y de ahí sale tanto "debes $X" (arriba y en cada tarjeta) como la lista.
  const detalleTarjetas = cargado
    ? tarjetas.map((t) => {
        const comprasBase = compras
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
        const cargosBase: CargoDomiciliadoResumen[] = gastosDomiciliados
          .filter((g) => g.activo && g.tarjetaId === t.id)
          .map((g) => {
            const ocurrencias = ocurrenciasDeGastoEnRangos(g, rangosCargos, CORTE_1);
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

        const comprado = comprasBase.reduce((s, c) => s + c.neto, 0);
        const pagado = pagos.filter((p) => p.tarjetaId === t.id).reduce((s, p) => s + p.cantidad, 0);
        const cargosPendientes = cargosBase.filter((c) => !c.pagadoAdelantado).reduce((s, c) => s + c.monto, 0);
        const debeVista = comprado - pagado + cargosPendientes;

        return {
          tarjeta: t,
          debeVista,
          comprasTarjeta: comprasBase.filter((c) => !soloPendientes || !c.pagada),
          cargosDomiciliados: cargosBase.filter((c) => !soloPendientes || !c.pagadoAdelantado),
        };
      })
    : null;

  // Mientras carga, se usa el total del servidor (ciclo de corte de la
  // tarjeta) como aproximación; en cuanto carga, se reemplaza por el de la
  // quincena que se está viendo.
  const total = detalleTarjetas
    ? detalleTarjetas.reduce((s, d) => s + d.debeVista, 0)
    : tarjetas.reduce((s, t) => s + t.debe, 0);

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
          {!detalleTarjetas ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : (
            detalleTarjetas.map(({ tarjeta: t, debeVista, comprasTarjeta, cargosDomiciliados }) => {
              if (comprasTarjeta.length === 0 && cargosDomiciliados.length === 0) {
                return null;
              }

              return (
                <div key={t.id}>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">
                    {t.nombre} · debes {formatearMoneda(debeVista)}
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
                  </ul>
                </div>
              );
            })
          )}
          <p className="text-[11px] text-gray-400">
            {soloPendientes
              ? 'En rojo lo que falta pagar. Cambia a "Actual" o "Mes" para ver también lo ya pagado.'
              : 'En rojo lo que falta pagar, en gris lo que ya marcaste como pagado.'}
          </p>
        </div>
      )}
    </div>
  );
}

export function ResumenFinanciero({ resumen, vista, onCambiarVista }: ResumenFinancieroProps) {
  // Ahorro total empieza oculto siempre que se abre la app; solo se destapa con el PIN.
  const [ocultarAhorro, setOcultarAhorro] = useState(true);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinIncorrecto, setPinIncorrecto] = useState(false);
  const p: IResumenPeriodo = resumen.periodos[vista];

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
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💵</span>
            <p className="text-xs font-medium text-green-800">Dinero disponible</p>
          </div>

          <p className="text-base sm:text-xl font-bold text-green-700 leading-tight">
            {formatearMoneda(p.dineroDisponible)}
          </p>
          <div className="mt-2 pt-2 border-t border-green-200">
            <p className="text-xs font-medium text-green-800">Dinero real</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <p
                className={`text-sm sm:text-base font-bold leading-tight ${
                  p.dineroReal < 0 ? 'text-red-600' : 'text-green-700'
                }`}
              >
                {formatearMoneda(p.dineroReal)}
              </p>
              {!!p.extra && p.extra > 0 && (
                <span
                  className="text-[11px] font-semibold text-emerald-600"
                  title="Sobrante de la quincena anterior que todavía no gastas"
                >
                  +{formatearMoneda(p.extra)} extra
                </span>
              )}
            </div>
            <p className="text-[11px] text-green-800/60 leading-tight">con pendientes ya liquidados</p>
          </div>
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

      <DeudaTarjetasExpandible tarjetas={resumen.deudaTarjetas} vista={vista} />
    </div>
  );
}
