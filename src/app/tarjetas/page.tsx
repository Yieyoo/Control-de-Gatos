// src/app/tarjetas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type {
  ITarjetaCredito,
  ICompraTarjeta,
  ICategoria,
  IPagoTarjeta,
  IGastoDomiciliado,
  IAhorroLugar,
  IDepositoTercero,
  IFuenteDinero,
} from '@/types';
import {
  formatearMoneda,
  formatearDiaMes,
  hoyMexico,
  cicloTarjetaActual,
  cicloTarjetaAnterior,
  ocurrenciasDeGastoEnRangos,
} from '@/utils/calculos';

const CORTE_1 = 10;

const ETIQUETA_FUENTE: Record<IFuenteDinero, string> = {
  disponible: '💵 Disponible',
  ahorro: '🏦 Ahorro',
  tercero: '🤝 Tercero',
};

export default function TarjetasPage() {
  const [tarjetas, setTarjetas] = useState<ITarjetaCredito[]>([]);
  const [compras, setCompras] = useState<ICompraTarjeta[]>([]);
  const [pagos, setPagos] = useState<IPagoTarjeta[]>([]);
  const [gastosDomiciliados, setGastosDomiciliados] = useState<IGastoDomiciliado[]>([]);
  const [categorias, setCategorias] = useState<ICategoria[]>([]);
  const [ahorroLugares, setAhorroLugares] = useState<IAhorroLugar[]>([]);
  const [depositosTerceros, setDepositosTerceros] = useState<IDepositoTercero[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarFormTarjeta, setMostrarFormTarjeta] = useState(false);
  const [formTarjeta, setFormTarjeta] = useState({ nombre: '', diaCorte: '', pagoQuincenal: '' });

  const [formCompraAbierto, setFormCompraAbierto] = useState<number | null>(null);
  const [formCompra, setFormCompra] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
    esMSI: false,
    numeroMeses: '',
  });

  const [editandoCompraId, setEditandoCompraId] = useState<number | null>(null);
  const [formEdicionCompra, setFormEdicionCompra] = useState({
    nombre: '',
    cantidad: '',
    categoriaId: '',
    tipoPresupuesto: 'gusto' as 'necesidad' | 'gusto',
  });

  const [formDevolucionAbierto, setFormDevolucionAbierto] = useState<number | null>(null);
  const [formDevolucion, setFormDevolucion] = useState({ cantidad: '', concepto: '' });

  const [formPagoAbierto, setFormPagoAbierto] = useState<number | null>(null);
  const [formPago, setFormPago] = useState({
    cantidad: '',
    concepto: '',
    fuente: 'disponible' as IFuenteDinero,
    ahorroLugarId: '',
    depositoTerceroId: '',
    compraTarjetaId: '',
  });

  const [formPagoCompraAbierto, setFormPagoCompraAbierto] = useState<number | null>(null);
  const [formPagoCompra, setFormPagoCompra] = useState({
    cantidad: '',
    fuente: 'disponible' as IFuenteDinero,
    ahorroLugarId: '',
    depositoTerceroId: '',
  });

  useEffect(() => {
    cargarTarjetas();
    cargarCompras();
    cargarPagos();
    cargarGastosDomiciliados();
    cargarCategorias();
    cargarAhorroLugares();
    cargarDepositosTerceros();
  }, []);

  const cargarAhorroLugares = async () => {
    try {
      const resp = await fetch('/api/ahorros');
      if (resp.ok) setAhorroLugares(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarDepositosTerceros = async () => {
    try {
      const resp = await fetch('/api/terceros');
      if (resp.ok) setDepositosTerceros(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarTarjetas = async () => {
    try {
      const resp = await fetch('/api/tarjetas');
      if (!resp.ok) throw new Error('Error al cargar tarjetas');
      setTarjetas(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const cargarCompras = async () => {
    try {
      const resp = await fetch('/api/tarjetas/compras');
      if (resp.ok) setCompras(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarPagos = async () => {
    try {
      const resp = await fetch('/api/tarjetas/pagos');
      if (resp.ok) setPagos(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const cargarGastosDomiciliados = async () => {
    try {
      const resp = await fetch('/api/gastos/domiciliados');
      if (resp.ok) setGastosDomiciliados(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePagadoAdelantado = async (gasto: IGastoDomiciliado, marcarComo: string | null) => {
    try {
      const resp = await fetch(`/api/gastos/domiciliados/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagadoAdelantadoHasta: marcarComo }),
      });
      if (!resp.ok) throw new Error('Error al actualizar');
      cargarGastosDomiciliados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const cargarCategorias = async () => {
    try {
      const resp = await fetch('/api/categorias');
      if (resp.ok) setCategorias(await resp.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitTarjeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formTarjeta),
      });
      if (!resp.ok) throw new Error('Error al crear tarjeta');
      setFormTarjeta({ nombre: '', diaCorte: '', pagoQuincenal: '' });
      setMostrarFormTarjeta(false);
      cargarTarjetas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarTarjeta = async (id: number) => {
    if (!confirm('¿Eliminar esta tarjeta y todas sus compras?')) return;
    try {
      const resp = await fetch(`/api/tarjetas/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarTarjetas();
      cargarCompras();
      cargarPagos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitPago = async (e: React.FormEvent, tarjetaId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formPago,
          tarjetaId,
          ahorroLugarId: formPago.fuente === 'ahorro' ? formPago.ahorroLugarId : undefined,
          depositoTerceroId: formPago.fuente === 'tercero' ? formPago.depositoTerceroId : undefined,
          compraTarjetaId: formPago.compraTarjetaId || undefined,
        }),
      });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => null);
        throw new Error(datos?.error || 'Error al registrar pago');
      }
      setFormPago({ cantidad: '', concepto: '', fuente: 'disponible', ahorroLugarId: '', depositoTerceroId: '', compraTarjetaId: '' });
      setFormPagoAbierto(null);
      cargarPagos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleEliminarPago = async (id: number) => {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      const resp = await fetch(`/api/tarjetas/pagos/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarPagos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const pagosDeCompra = (compraId: number) => pagos.filter((p) => p.compraTarjetaId === compraId);

  const abrirPagoCompra = (compra: ICompraTarjeta, cantidadSugerida: number) => {
    setFormPagoCompraAbierto(compra.id);
    setFormPagoCompra({
      cantidad: cantidadSugerida > 0 ? String(cantidadSugerida) : '',
      fuente: 'disponible',
      ahorroLugarId: '',
      depositoTerceroId: '',
    });
  };

  const handleSubmitPagoCompra = async (e: React.FormEvent, compra: ICompraTarjeta, tarjetaId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarjetaId,
          cantidad: formPagoCompra.cantidad,
          concepto: `Pago: ${compra.nombre}`,
          fuente: formPagoCompra.fuente,
          ahorroLugarId: formPagoCompra.fuente === 'ahorro' ? formPagoCompra.ahorroLugarId : undefined,
          depositoTerceroId: formPagoCompra.fuente === 'tercero' ? formPagoCompra.depositoTerceroId : undefined,
          compraTarjetaId: compra.id,
        }),
      });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => null);
        throw new Error(datos?.error || 'Error al registrar el pago');
      }
      setFormPagoCompraAbierto(null);
      cargarPagos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleQuitarPagosCompra = async (compra: ICompraTarjeta) => {
    if (!confirm('¿Quitar el pago (o pagos) registrados para esta compra?')) return;
    try {
      await Promise.all(
        pagosDeCompra(compra.id).map((p) => fetch(`/api/tarjetas/pagos/${p.id}`, { method: 'DELETE' }))
      );
      cargarPagos();
      cargarAhorroLugares();
      cargarDepositosTerceros();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleCategoriaCompraChange = (categoriaId: string) => {
    const categoria = categorias.find((c) => String(c.id) === categoriaId);
    setFormCompra({ ...formCompra, categoriaId, tipoPresupuesto: categoria?.tipoPresupuesto ?? 'gusto' });
  };

  const handleSubmitCompra = async (e: React.FormEvent, tarjetaId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/tarjetas/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formCompra,
          tarjetaId,
          numeroMeses: formCompra.esMSI ? formCompra.numeroMeses : undefined,
        }),
      });
      if (!resp.ok) throw new Error('Error al registrar compra');
      setFormCompra({ nombre: '', cantidad: '', categoriaId: '', tipoPresupuesto: 'gusto', esMSI: false, numeroMeses: '' });
      setFormCompraAbierto(null);
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleSubmitDevolucion = async (e: React.FormEvent, compraTarjetaId: number) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formDevolucion, compraTarjetaId }),
      });
      if (!resp.ok) throw new Error('Error al registrar devolución');
      setFormDevolucion({ cantidad: '', concepto: '' });
      setFormDevolucionAbierto(null);
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const netoCompra = (compra: ICompraTarjeta) =>
    compra.cantidad - (compra.devoluciones ?? []).reduce((s, d) => s + d.cantidad, 0);

  const handleEliminarCompra = async (id: number) => {
    if (!confirm('¿Eliminar esta compra?')) return;
    try {
      const resp = await fetch(`/api/tarjetas/compras/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const iniciarEdicionCompra = (compra: ICompraTarjeta) => {
    setEditandoCompraId(compra.id);
    setFormEdicionCompra({
      nombre: compra.nombre,
      cantidad: String(compra.cantidad),
      categoriaId: compra.categoriaId ? String(compra.categoriaId) : '',
      tipoPresupuesto: compra.tipoPresupuesto ?? compra.categoria?.tipoPresupuesto ?? 'gusto',
    });
  };

  const handleCategoriaEdicionCompraChange = (categoriaId: string) => {
    const categoria = categorias.find((c) => String(c.id) === categoriaId);
    setFormEdicionCompra({
      ...formEdicionCompra,
      categoriaId,
      tipoPresupuesto: categoria?.tipoPresupuesto ?? 'gusto',
    });
  };

  const handleGuardarEdicionCompra = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    try {
      const resp = await fetch(`/api/tarjetas/compras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdicionCompra),
      });
      if (!resp.ok) throw new Error('Error al actualizar compra');
      setEditandoCompraId(null);
      cargarCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  if (cargando) return <div>Cargando...</div>;

  const hoy = hoyMexico();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💳 Tarjeta de Crédito</h1>
        <p className="text-gray-600 mt-1">Tus compras y el corte de cada tarjeta</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
      )}

      {tarjetas.map((tarjeta) => {
        const cicloActual = cicloTarjetaActual(hoy, tarjeta.diaCorte);
        const cicloAnterior = cicloTarjetaAnterior(cicloActual, tarjeta.diaCorte);

        const enCiclo = (c: ICompraTarjeta, rango: { inicio: Date; fin: Date }) => {
          const f = new Date(c.fecha);
          return c.tarjetaId === tarjeta.id && f >= rango.inicio && f <= rango.fin;
        };

        const comprasActual = compras.filter((c) => enCiclo(c, cicloActual));
        const comprasAnterior = compras.filter((c) => enCiclo(c, cicloAnterior));
        const totalActual = comprasActual.reduce((s, c) => s + netoCompra(c), 0);
        const totalAnterior = comprasAnterior.reduce((s, c) => s + netoCompra(c), 0);

        const pagosTarjeta = pagos.filter((p) => p.tarjetaId === tarjeta.id);
        const totalCompradoSiempre = compras
          .filter((c) => c.tarjetaId === tarjeta.id)
          .reduce((s, c) => s + netoCompra(c), 0);
        const totalPagado = pagosTarjeta.reduce((s, p) => s + p.cantidad, 0);

        const cargosDomiciliadosTarjeta = gastosDomiciliados
          .filter((g) => g.activo && g.tarjetaId === tarjeta.id)
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
            return { gasto: g, fechaMasReciente, monto, pagadoAdelantado };
          })
          .filter((c) => c.fechaMasReciente !== null);

        const totalCargosPendientes = cargosDomiciliadosTarjeta
          .filter((c) => !c.pagadoAdelantado)
          .reduce((s, c) => s + c.monto, 0);

        const debeTotal = totalCompradoSiempre - totalPagado + totalCargosPendientes;

        return (
          <div key={tarjeta.id} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{tarjeta.nombre}</h2>
                <p className="text-xs text-gray-500">Corta el día {tarjeta.diaCorte} de cada mes</p>
              </div>
              <button onClick={() => handleEliminarTarjeta(tarjeta.id)} className="text-red-600 hover:text-red-800">
                🗑️
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="text-xs font-medium text-orange-800">
                  Corte anterior ({formatearDiaMes(cicloAnterior.inicio)} - {formatearDiaMes(cicloAnterior.fin)})
                </p>
                <p className="text-xl font-bold text-orange-700 mt-1">{formatearMoneda(totalAnterior)}</p>
                <p className="text-xs text-orange-700/70 mt-0.5">Ya cerró — esto es lo que debes pagar</p>
                {tarjeta.pagoQuincenal != null && (
                  <p className="text-xs text-orange-700/70">
                    Planeas pagar {formatearMoneda(tarjeta.pagoQuincenal)}/quincena
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-800">
                  Periodo actual ({formatearDiaMes(cicloActual.inicio)} - {formatearDiaMes(cicloActual.fin)})
                </p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatearMoneda(totalActual)}</p>
                <p className="text-xs text-blue-700/70 mt-0.5">Se sigue acumulando</p>
              </div>
            </div>

            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs font-medium text-red-800">Debes en total (compras + domiciliados menos pagos)</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{formatearMoneda(debeTotal)}</p>
            </div>

            {cargosDomiciliadosTarjeta.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-2">Cargos domiciliados de este periodo</p>
                <div className="space-y-2">
                  {cargosDomiciliadosTarjeta.map(({ gasto, monto, pagadoAdelantado, fechaMasReciente }) => (
                    <label
                      key={gasto.id}
                      className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold truncate ${pagadoAdelantado ? 'text-gray-400 line-through' : ''}`}>
                          {gasto.nombre}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {pagadoAdelantado ? 'Ya lo pagaste por adelantado' : 'Pendiente de este periodo'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className={`font-bold whitespace-nowrap ${pagadoAdelantado ? 'text-gray-400' : 'text-red-600'}`}>
                          {formatearMoneda(monto)}
                        </p>
                        <input
                          type="checkbox"
                          checked={pagadoAdelantado}
                          onChange={() =>
                            handleTogglePagadoAdelantado(
                              gasto,
                              pagadoAdelantado ? null : fechaMasReciente!.toISOString()
                            )
                          }
                          className="w-5 h-5"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formCompraAbierto !== tarjeta.id ? (
              <button
                onClick={() => setFormCompraAbierto(tarjeta.id)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Agregar compra
              </button>
            ) : (
              <form
                onSubmit={(e) => handleSubmitCompra(e, tarjeta.id)}
                className="space-y-3 bg-gray-50 rounded-lg p-4"
              >
                <input
                  type="text"
                  placeholder="Concepto de la compra"
                  value={formCompra.nombre}
                  onChange={(e) => setFormCompra({ ...formCompra, nombre: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={formCompra.cantidad}
                  onChange={(e) => setFormCompra({ ...formCompra, cantidad: e.target.value })}
                  required
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <select
                  value={formCompra.categoriaId}
                  onChange={(e) => handleCategoriaCompraChange(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Categoría (opcional)</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formCompra.esMSI}
                    onChange={(e) => setFormCompra({ ...formCompra, esMSI: e.target.checked })}
                    className="w-4 h-4"
                  />
                  ¿A meses sin intereses?
                </label>
                {formCompra.esMSI && (
                  <input
                    type="number"
                    placeholder="Número de meses (ej: 12)"
                    value={formCompra.numeroMeses}
                    onChange={(e) => setFormCompra({ ...formCompra, numeroMeses: e.target.value })}
                    required
                    min={2}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                )}
                {formCompra.esMSI && formCompra.numeroMeses && formCompra.cantidad && (
                  <p className="text-xs text-gray-500">
                    {formatearMoneda(parseFloat(formCompra.cantidad) / parseInt(formCompra.numeroMeses))}/mes durante {formCompra.numeroMeses} meses
                  </p>
                )}
                <div>
                  <p className="text-sm text-gray-600 mb-1">¿A qué se destina?</p>
                  <div className="flex bg-white rounded-lg p-1 text-sm font-medium w-fit border border-gray-200">
                    {(['necesidad', 'gusto'] as const).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setFormCompra({ ...formCompra, tipoPresupuesto: tipo })}
                        className={`px-3 py-1.5 rounded-md transition-colors ${
                          formCompra.tipoPresupuesto === tipo ? 'bg-gray-900 text-white' : 'text-gray-500'
                        }`}
                      >
                        {tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCompraAbierto(null)}
                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">Compras de este periodo</p>
              {comprasActual.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no tienes compras en este periodo.</p>
              ) : (
                <div className="space-y-2">
                  {comprasActual.map((c) =>
                    editandoCompraId === c.id ? (
                      <form
                        key={c.id}
                        onSubmit={(e) => handleGuardarEdicionCompra(e, c.id)}
                        className="space-y-3 bg-gray-50 rounded-lg p-4 border border-blue-300"
                      >
                        <input
                          type="text"
                          placeholder="Concepto de la compra"
                          value={formEdicionCompra.nombre}
                          onChange={(e) => setFormEdicionCompra({ ...formEdicionCompra, nombre: e.target.value })}
                          required
                          className="w-full border border-gray-300 rounded px-3 py-2"
                        />
                        <input
                          type="number"
                          placeholder="Cantidad"
                          value={formEdicionCompra.cantidad}
                          onChange={(e) => setFormEdicionCompra({ ...formEdicionCompra, cantidad: e.target.value })}
                          required
                          step="0.01"
                          className="w-full border border-gray-300 rounded px-3 py-2"
                        />
                        <select
                          value={formEdicionCompra.categoriaId}
                          onChange={(e) => handleCategoriaEdicionCompraChange(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2"
                        >
                          <option value="">Categoría (opcional)</option>
                          {categorias.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                          ))}
                        </select>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">¿A qué se destina?</p>
                          <div className="flex bg-white rounded-lg p-1 text-sm font-medium w-fit border border-gray-200">
                            {(['necesidad', 'gusto'] as const).map((tipo) => (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => setFormEdicionCompra({ ...formEdicionCompra, tipoPresupuesto: tipo })}
                                className={`px-3 py-1.5 rounded-md transition-colors ${
                                  formEdicionCompra.tipoPresupuesto === tipo ? 'bg-gray-900 text-white' : 'text-gray-500'
                                }`}
                              >
                                {tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoCompraId(null)}
                            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div key={c.id} className="border border-gray-200 rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{c.nombre}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {c.categoria?.nombre ?? 'Sin categoría'} • {formatearDiaMes(new Date(c.fecha))}
                              {c.numeroMeses && ` • ${c.numeroMeses} MSI (${formatearMoneda(c.montoMensual ?? 0)}/mes)`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-red-600 whitespace-nowrap">{formatearMoneda(netoCompra(c))}</p>
                              {(c.devoluciones?.length ?? 0) > 0 && (
                                <p className="text-xs text-gray-400 whitespace-nowrap line-through">{formatearMoneda(c.cantidad)}</p>
                              )}
                            </div>
                            <button onClick={() => iniciarEdicionCompra(c)} className="text-blue-600 hover:text-blue-800">
                              ✏️
                            </button>
                            <button onClick={() => handleEliminarCompra(c.id)} className="text-red-600 hover:text-red-800">
                              🗑️
                            </button>
                          </div>
                        </div>

                        {formDevolucionAbierto === c.id ? (
                          <form
                            onSubmit={(e) => handleSubmitDevolucion(e, c.id)}
                            className="flex flex-wrap items-center gap-2 bg-gray-50 rounded p-2"
                          >
                            <input
                              type="number"
                              placeholder="Cantidad devuelta"
                              value={formDevolucion.cantidad}
                              onChange={(e) => setFormDevolucion({ ...formDevolucion, cantidad: e.target.value })}
                              required
                              step="0.01"
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-36"
                            />
                            <input
                              type="text"
                              placeholder="Concepto (opcional)"
                              value={formDevolucion.concepto}
                              onChange={(e) => setFormDevolucion({ ...formDevolucion, concepto: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[7rem]"
                            />
                            <button type="submit" className="bg-green-600 text-white px-2.5 py-1 rounded text-sm hover:bg-green-700">
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormDevolucionAbierto(null)}
                              className="bg-gray-400 text-white px-2.5 py-1 rounded text-sm hover:bg-gray-500"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <button onClick={() => setFormDevolucionAbierto(c.id)} className="text-xs text-blue-600 hover:text-blue-800">
                            ↩️ Registrar devolución
                          </button>
                        )}

                        {(() => {
                          const pagosCompra = pagosDeCompra(c.id);
                          const montoPagado = pagosCompra.reduce((s, p) => s + p.cantidad, 0);
                          const neto = netoCompra(c);
                          const pagada = montoPagado >= neto - 0.01;
                          const saldoPendiente = Math.max(0, neto - montoPagado);

                          return (
                            <div className="pt-1 border-t border-gray-100 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4"
                                    checked={pagada}
                                    onChange={() =>
                                      pagada ? handleQuitarPagosCompra(c) : abrirPagoCompra(c, saldoPendiente)
                                    }
                                  />
                                  {pagada
                                    ? '✅ Pagada'
                                    : montoPagado > 0
                                    ? `Pagado ${formatearMoneda(montoPagado)} de ${formatearMoneda(neto)}`
                                    : 'Sin pagar'}
                                </label>
                                {!pagada && (
                                  <button
                                    type="button"
                                    onClick={() => abrirPagoCompra(c, 0)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    💰 Pagar una parte
                                  </button>
                                )}
                              </div>

                              {formPagoCompraAbierto === c.id && (
                                <form
                                  onSubmit={(e) => handleSubmitPagoCompra(e, c, tarjeta.id)}
                                  className="space-y-2 bg-gray-50 rounded p-3"
                                >
                                  <input
                                    type="number"
                                    placeholder="Cantidad a pagar"
                                    value={formPagoCompra.cantidad}
                                    onChange={(e) => setFormPagoCompra({ ...formPagoCompra, cantidad: e.target.value })}
                                    required
                                    step="0.01"
                                    max={saldoPendiente || undefined}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                  />
                                  <div className="flex bg-white rounded-lg p-1 text-xs font-medium w-fit border border-gray-200 flex-wrap">
                                    {(['disponible', 'ahorro', 'tercero'] as const).map((f) => (
                                      <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFormPagoCompra({ ...formPagoCompra, fuente: f })}
                                        className={`px-2.5 py-1 rounded-md transition-colors ${
                                          formPagoCompra.fuente === f ? 'bg-gray-900 text-white' : 'text-gray-500'
                                        }`}
                                      >
                                        {ETIQUETA_FUENTE[f]}
                                      </button>
                                    ))}
                                  </div>
                                  {formPagoCompra.fuente === 'ahorro' && (
                                    <select
                                      value={formPagoCompra.ahorroLugarId}
                                      onChange={(e) => setFormPagoCompra({ ...formPagoCompra, ahorroLugarId: e.target.value })}
                                      required
                                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                    >
                                      <option value="">¿De qué cuenta de ahorro?</option>
                                      {ahorroLugares.map((a) => (
                                        <option key={a.id} value={a.id}>{a.nombre} ({formatearMoneda(a.saldoActual)})</option>
                                      ))}
                                    </select>
                                  )}
                                  {formPagoCompra.fuente === 'tercero' && (
                                    <select
                                      value={formPagoCompra.depositoTerceroId}
                                      onChange={(e) => setFormPagoCompra({ ...formPagoCompra, depositoTerceroId: e.target.value })}
                                      required
                                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                    >
                                      <option value="">¿Con qué depósito de tercero?</option>
                                      {depositosTerceros
                                        .filter((d) => d.pendiente > 0)
                                        .map((d) => (
                                          <option key={d.id} value={d.id}>
                                            {d.persona} — {d.concepto} ({formatearMoneda(d.pendiente)} pendiente)
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                  <div className="flex gap-2">
                                    <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFormPagoCompraAbierto(null)}
                                      className="bg-gray-400 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-500"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-200">
              {formPagoAbierto !== tarjeta.id ? (
                <button
                  onClick={() => setFormPagoAbierto(tarjeta.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  + Registrar pago
                </button>
              ) : (
                <form
                  onSubmit={(e) => handleSubmitPago(e, tarjeta.id)}
                  className="space-y-3 bg-gray-50 rounded-lg p-4"
                >
                  <input
                    type="text"
                    placeholder="Concepto (opcional, ej: Pago quincenal)"
                    value={formPago.concepto}
                    onChange={(e) => setFormPago({ ...formPago, concepto: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={formPago.cantidad}
                    onChange={(e) => setFormPago({ ...formPago, cantidad: e.target.value })}
                    required
                    step="0.01"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <div>
                    <p className="text-sm text-gray-600 mb-1">¿De dónde sale el dinero?</p>
                    <div className="flex bg-white rounded-lg p-1 text-sm font-medium w-fit border border-gray-200 flex-wrap">
                      {(['disponible', 'ahorro', 'tercero'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormPago({ ...formPago, fuente: f })}
                          className={`px-3 py-1.5 rounded-md transition-colors ${
                            formPago.fuente === f ? 'bg-gray-900 text-white' : 'text-gray-500'
                          }`}
                        >
                          {ETIQUETA_FUENTE[f]}
                        </button>
                      ))}
                    </div>
                    {formPago.fuente === 'ahorro' && (
                      <select
                        value={formPago.ahorroLugarId}
                        onChange={(e) => setFormPago({ ...formPago, ahorroLugarId: e.target.value })}
                        required
                        className="w-full border border-gray-300 rounded px-3 py-2 mt-2"
                      >
                        <option value="">¿De qué cuenta de ahorro?</option>
                        {ahorroLugares.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre} ({formatearMoneda(a.saldoActual)})</option>
                        ))}
                      </select>
                    )}
                    {formPago.fuente === 'tercero' && (
                      <select
                        value={formPago.depositoTerceroId}
                        onChange={(e) => setFormPago({ ...formPago, depositoTerceroId: e.target.value })}
                        required
                        className="w-full border border-gray-300 rounded px-3 py-2 mt-2"
                      >
                        <option value="">¿Con qué depósito de tercero?</option>
                        {depositosTerceros
                          .filter((d) => d.pendiente > 0)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.persona} — {d.concepto} ({formatearMoneda(d.pendiente)} pendiente)
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                  {compras.filter((c) => c.tarjetaId === tarjeta.id).length > 0 && (
                    <select
                      value={formPago.compraTarjetaId}
                      onChange={(e) => setFormPago({ ...formPago, compraTarjetaId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="">¿A qué compra corresponde? (opcional)</option>
                      {compras
                        .filter((c) => c.tarjetaId === tarjeta.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}{c.numeroMeses ? ` (${c.numeroMeses} MSI)` : ''}
                          </option>
                        ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPagoAbierto(null)}
                      className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {pagosTarjeta.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-gray-500 mb-2">Pagos realizados</p>
                  <div className="space-y-2">
                    {pagosTarjeta.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{p.concepto || 'Pago a la tarjeta'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {formatearDiaMes(new Date(p.fecha))} • {ETIQUETA_FUENTE[p.fuente]}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <p className="font-bold text-green-600 whitespace-nowrap">{formatearMoneda(p.cantidad)}</p>
                          <button onClick={() => handleEliminarPago(p.id)} className="text-red-600 hover:text-red-800">
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!mostrarFormTarjeta && (
        <button
          onClick={() => setMostrarFormTarjeta(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar tarjeta
        </button>
      )}

      {mostrarFormTarjeta && (
        <form onSubmit={handleSubmitTarjeta} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre de la tarjeta (ej: BBVA Oro)"
            value={formTarjeta.nombre}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, nombre: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Día de corte (1-31)"
            value={formTarjeta.diaCorte}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, diaCorte: e.target.value })}
            required
            min={1}
            max={31}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Pago que planeas hacer cada quincena (opcional)"
            value={formTarjeta.pagoQuincenal}
            onChange={(e) => setFormTarjeta({ ...formTarjeta, pagoQuincenal: e.target.value })}
            step="0.01"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormTarjeta(false)}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
