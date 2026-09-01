'use client';

import { useEffect, useState } from 'react';
import {
  formatearMoneda,
  formatearDiaMes,
  hoyMexico,
  periodoQuincenaActual,
  periodoQuincenaSiguiente,
  rangoMesActual,
  ocurrenciasDeGastoEnRangos,
  type RangoFechas,
} from '@/utils/calculos';
import type { IDashboardResumen, IResumenPeriodo, ICompraTarjeta, IPagoTarjeta, IGastoDomiciliado, IMovimientoPeriodo } from '@/types';
import {
  CreditCard,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  PiggyBank,
  FileText,
  ShoppingCart,
  Banknote,
  Landmark,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';

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
  // según la quincena/mes que se esté viendo, no según el ciclo de corte de
  // la tarjeta -- así uno que cobra el día 28 solo suma a la deuda (y aparece
  // en la lista) en el periodo donde realmente cae, no antes. "Mes" usa el
  // calendario completo (1 al último día), igual que Dinero disponible/real
  // y Gastos fijos de esa misma tarjeta -- no la suma de las dos quincenas,
  // que se sale del mes de calendario.
  const periodoActual = periodoQuincenaActual(hoy, CORTE_1, CORTE_2);
  const periodoProximo = periodoQuincenaSiguiente(periodoActual, CORTE_1, CORTE_2);
  const rangoMes = rangoMesActual(hoy);
  const rangosCargos: RangoFechas[] =
    vista === 'quincena1' ? [periodoActual] : vista === 'quincena2' ? [periodoProximo] : [rangoMes];

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
          <CreditCard className="w-4 h-4 text-gray-500" strokeWidth={1.75} /> Deuda de tarjetas
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold text-red-600">{formatearMoneda(total)}</span>
          {expandido ? (
            <ChevronUp className="w-4 h-4 text-gray-400" strokeWidth={2} />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={2} />
          )}
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

type TileClave = 'ingresos' | 'ahorro' | 'gastosFijos' | 'gastosVariables';

export function ResumenFinanciero({ resumen, vista, onCambiarVista }: ResumenFinancieroProps) {
  // Ingresos y ahorro empiezan ocultos siempre que se abre la app; un solo
  // ojo junto a "Resumen" los destapa a todos (Ingresos, Ahorro del periodo y
  // Ahorro e inversión) de una vez, protegido con el mismo PIN.
  const [ocultarSensibles, setOcultarSensibles] = useState(true);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinIncorrecto, setPinIncorrecto] = useState(false);
  const [tileAbierto, setTileAbierto] = useState<TileClave | null>(null);
  const p: IResumenPeriodo = resumen.periodos[vista];

  // Mismo desglose que ya arma `movimientos` para el periodo, solo separado
  // por qué tile lo cuenta -- gastos fijos son domiciliados (efectivo o
  // tarjeta); gastos variables es todo lo demás manual, uno-a-la-vez.
  const gastosFijosItems = p.movimientos.filter(
    (m) => m.tipo === 'gasto' && (m.gastoDomiciliadoId != null || m.credito)
  );
  const gastosVariablesItems = p.movimientos.filter(
    (m) => m.tipo === 'gasto' && m.gastoDomiciliadoId == null && !m.credito
  );
  const ahorroItems = p.movimientos.filter((m) => m.tipo === 'ahorro');

  const abrirPromptPin = () => {
    setPin('');
    setPinIncorrecto(false);
    setPidiendoPin(true);
  };

  const ocultarDeNuevo = () => {
    setOcultarSensibles(true);
    setPidiendoPin(false);
    setPin('');
  };

  const handleSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_AHORRO) {
      setOcultarSensibles(false);
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
      clave: 'ingresos' as TileClave,
      titulo: 'Ingresos',
      cantidad: p.ingresos,
      badge: 'bg-blue-100 text-blue-700',
      icono: TrendingUp,
      sensible: true,
    },
    {
      clave: 'ahorro' as TileClave,
      titulo: 'Ahorro',
      cantidad: p.ahorroDelMes,
      subtitulo: p.ahorroDelMesPendiente > 0 ? `+${formatearMoneda(p.ahorroDelMesPendiente)} pendiente` : undefined,
      badge: 'bg-violet-100 text-violet-700',
      icono: PiggyBank,
      sensible: false,
    },
    {
      clave: 'gastosFijos' as TileClave,
      titulo: 'Gastos fijos',
      cantidad: p.gastosFijos,
      subtitulo: p.gastosFijosPendiente > 0 ? `+${formatearMoneda(p.gastosFijosPendiente)} pendiente` : undefined,
      badge: 'bg-orange-100 text-orange-700',
      icono: FileText,
      sensible: false,
    },
    {
      clave: 'gastosVariables' as TileClave,
      titulo: 'Gastos variables',
      cantidad: p.gastosVariables,
      badge: 'bg-pink-100 text-pink-700',
      icono: ShoppingCart,
      sensible: false,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold text-gray-900">Resumen</h2>
          <button
            type="button"
            onClick={ocultarSensibles ? abrirPromptPin : ocultarDeNuevo}
            aria-label={ocultarSensibles ? 'Mostrar ingresos y ahorro e inversión' : 'Ocultar ingresos y ahorro e inversión'}
            title={ocultarSensibles ? 'Mostrar ingresos y ahorro e inversión' : 'Ocultar ingresos y ahorro e inversión'}
            className="text-gray-400 hover:text-gray-600"
          >
            {ocultarSensibles ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
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

      {pidiendoPin && (
        <form onSubmit={handleSubmitPin} className="mb-3">
          <div className="flex gap-1.5">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="PIN para ver ingresos y ahorro e inversión"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinIncorrecto(false);
              }}
              className={`min-w-0 flex-1 border rounded px-2 py-1.5 text-sm ${
                pinIncorrecto ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            <button
              type="submit"
              className="flex-shrink-0 bg-blue-600 text-white text-sm font-medium px-2.5 rounded hover:bg-blue-700 flex items-center justify-center"
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setPidiendoPin(false)}
              aria-label="Cancelar"
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 px-1"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          {pinIncorrecto && <p className="text-[11px] text-red-600 mt-1">PIN incorrecto</p>}
        </form>
      )}

      <p className="text-xs text-gray-500 mb-4">{p.rangoTexto}</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {tarjetas.map((tarjeta) => {
          const oculto = tarjeta.sensible && ocultarSensibles;
          return (
            <button
              key={tarjeta.titulo}
              type="button"
              onClick={() => !oculto && setTileAbierto(tarjeta.clave)}
              disabled={oculto}
              className="flex items-start gap-3 text-left rounded-lg p-1 -m-1 active:bg-gray-50 disabled:active:bg-transparent"
            >
              <div className={`w-10 h-10 rounded-xl ${tarjeta.badge} flex items-center justify-center flex-shrink-0`}>
                <tarjeta.icono className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 leading-tight">{tarjeta.titulo}</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                  {oculto ? '•••••' : formatearMoneda(tarjeta.cantidad)}
                </p>
                {tarjeta.subtitulo && (
                  <p className="text-xs text-amber-600 leading-tight">{oculto ? '••••' : tarjeta.subtitulo}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-5 h-5 text-green-700" strokeWidth={1.75} />
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
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-5 h-5 text-blue-700" strokeWidth={1.75} />
            <p className="text-xs font-medium text-blue-800">Ahorro e inversión</p>
          </div>

          <p className="text-base sm:text-xl font-bold text-blue-700 leading-tight">
            {ocultarSensibles ? '•••••••' : formatearMoneda(resumen.ahorroTotal)}
          </p>
          {resumen.ahorrosLugares.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200 space-y-0.5">
              {resumen.ahorrosLugares.map((ahorro) => (
                <div key={ahorro.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-blue-800/70 truncate">{ahorro.nombre}</span>
                  <span className="text-[11px] font-semibold text-blue-800 flex-shrink-0">
                    {ocultarSensibles ? '•••' : formatearMoneda(ahorro.saldoActual)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DeudaTarjetasExpandible tarjetas={resumen.deudaTarjetas} vista={vista} />

      {tileAbierto && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setTileAbierto(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] flex flex-col bg-white rounded-t-2xl p-5 pb-6 shadow-lg">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 flex-shrink-0" />
            {(() => {
              const tarjeta = tarjetas.find((t) => t.clave === tileAbierto)!;
              const items =
                tileAbierto === 'ingresos'
                  ? p.ingresosDetalle
                  : tileAbierto === 'ahorro'
                    ? ahorroItems
                    : tileAbierto === 'gastosFijos'
                      ? gastosFijosItems
                      : gastosVariablesItems;

              return (
                <>
                  <div className="flex items-start justify-between gap-3 mb-1 flex-shrink-0">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <tarjeta.icono className="w-5 h-5 text-gray-700" strokeWidth={1.75} /> {tarjeta.titulo}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">{formatearMoneda(tarjeta.cantidad)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTileAbierto(null)}
                      aria-label="Cerrar"
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X className="w-5 h-5" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="overflow-y-auto mt-3 -mx-1 px-1">
                    {items.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4">Nada registrado aquí en este periodo.</p>
                    ) : tileAbierto === 'ingresos' ? (
                      <ul className="divide-y divide-gray-100">
                        {(items as { nombre: string; cantidad: number }[]).map((item, i) => (
                          <li key={i} className="py-2.5 flex items-center gap-3">
                            <p className="min-w-0 flex-1 text-sm text-gray-900 truncate">{item.nombre}</p>
                            <p className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">
                              {formatearMoneda(item.cantidad)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {(items as IMovimientoPeriodo[]).map((m, i) => (
                          <li key={i} className="py-2.5 flex items-center gap-3">
                            {tileAbierto !== 'ahorro' && (
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: m.categoriaColor ?? '#e34948' }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm truncate ${m.pagado ? 'text-gray-400' : 'text-gray-900'}`}>
                                {m.nombre}
                                {m.obligatorio === false && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 align-middle">
                                    Opcional
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatearDiaMes(new Date(m.fecha))} · {m.pagado ? 'confirmado' : 'pendiente'}
                              </p>
                            </div>
                            <p
                              className={`text-sm font-semibold flex-shrink-0 tabular-nums ${
                                m.pagado ? 'text-gray-400' : tileAbierto === 'ahorro' ? 'text-blue-600' : 'text-red-600'
                              }`}
                            >
                              {formatearMoneda(m.cantidad)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
