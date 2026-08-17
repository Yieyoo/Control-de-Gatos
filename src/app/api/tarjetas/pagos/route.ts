// src/app/api/tarjetas/pagos/route.ts
import { prisma } from '@/lib/prisma';
import { crearPagoTarjeta, validarFuente } from '@/lib/finanzas';

export async function GET() {
  try {
    const pagos = await prisma.pagoTarjeta.findMany({
      include: { tarjeta: true, ahorroLugar: true, depositoTercero: true, compraTarjeta: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(pagos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tarjetaId, cantidad, concepto, fecha, fuente, ahorroLugarId, depositoTerceroId, compraTarjetaId } = body;

    if (!tarjetaId || !cantidad) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const fuenteFinal = fuente || 'disponible';
    const errorFuente = validarFuente({
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? parseInt(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? parseInt(depositoTerceroId) : null,
      cantidad: parseFloat(cantidad),
    });
    if (errorFuente) {
      return Response.json({ error: errorFuente }, { status: 400 });
    }

    const pago = await crearPagoTarjeta({
      tarjetaId: parseInt(tarjetaId),
      cantidad: parseFloat(cantidad),
      concepto: concepto || null,
      fecha: fecha ? new Date(fecha) : undefined,
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? parseInt(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? parseInt(depositoTerceroId) : null,
      compraTarjetaId: compraTarjetaId ? parseInt(compraTarjetaId) : null,
    });

    return Response.json(pago, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}
