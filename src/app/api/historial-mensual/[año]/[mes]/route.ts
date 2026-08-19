// src/app/api/historial-mensual/[año]/[mes]/route.ts
import { prisma } from '@/lib/prisma';
import { construirPeriodo } from '@/lib/periodo';
import { gastoNeto } from '@/utils/finanzas';
import { hoyMexico, rangoMes, fechaEnRangos, formatearDiaMes } from '@/utils/calculos';
import type { IMesDetalle, IFuenteDinero } from '@/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ año: string; mes: string }> }
) {
  try {
    const { año: añoStr, mes: mesStr } = await params;
    const año = parseInt(añoStr, 10);
    const mes = parseInt(mesStr, 10); // 0-indexado, como Date normal

    if (!Number.isInteger(año) || !Number.isInteger(mes) || mes < 0 || mes > 11) {
      return Response.json({ error: 'Mes o año inválido' }, { status: 400 });
    }

    const [
      ingresos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosFijos,
      gastosVariables,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro,
    ] = await Promise.all([
      prisma.ingreso.findMany({ where: { activo: true } }),
      prisma.gastoDomiciliado.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.ahorroDomiciliado.findMany({ where: { activo: true } }),
      prisma.gastoFijo.findMany({ where: { activo: true }, include: { categoria: true } }),
      prisma.gastoVariable.findMany({ include: { categoria: true, devoluciones: true } }),
      prisma.compraTarjeta.findMany({ include: { categoria: true, devoluciones: true, tarjeta: true } }),
      prisma.pagoTarjeta.findMany({ include: { tarjeta: true } }),
      prisma.movimientoAhorro.findMany(),
    ]);

    const rango = rangoMes(año, mes);
    const hoy = hoyMexico();

    const periodo = construirPeriodo(
      'mes',
      `${MESES[mes]} ${año}`,
      `${formatearDiaMes(rango.inicio)} - ${formatearDiaMes(rango.fin)}`,
      [rango],
      false,
      hoy,
      ingresos,
      gastosFijos,
      gastosDomiciliados,
      ahorrosDomiciliados,
      gastosVariables,
      comprasTarjeta,
      pagosTarjeta,
      movimientosAhorro
    );

    const comprasTarjetaMes = comprasTarjeta
      .filter((c) => fechaEnRangos(new Date(c.fecha), [rango]))
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        cantidad: gastoNeto(c.cantidad, c.devoluciones),
        fecha: new Date(c.fecha).toISOString(),
        tarjetaNombre: c.tarjeta.nombre,
        categoriaNombre: c.categoria?.nombre,
        categoriaColor: c.categoria?.color,
        numeroMeses: c.numeroMeses ?? undefined,
      }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const pagosTarjetaMes = pagosTarjeta
      .filter((p) => fechaEnRangos(new Date(p.fecha), [rango]))
      .map((p) => ({
        id: p.id,
        cantidad: p.cantidad,
        fecha: new Date(p.fecha).toISOString(),
        concepto: p.concepto ?? undefined,
        tarjetaNombre: p.tarjeta.nombre,
        fuente: p.fuente as IFuenteDinero,
      }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const detalle: IMesDetalle = {
      ...periodo,
      año,
      mes,
      comprasTarjeta: comprasTarjetaMes,
      pagosTarjeta: pagosTarjetaMes,
    };

    return Response.json(detalle);
  } catch (error) {
    console.error('Error en detalle de historial mensual:', error);
    return Response.json({ error: 'Error al calcular el detalle del mes' }, { status: 500 });
  }
}
