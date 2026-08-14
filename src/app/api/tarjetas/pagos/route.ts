// src/app/api/tarjetas/pagos/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const pagos = await prisma.pagoTarjeta.findMany({
      include: { tarjeta: true },
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
    const { tarjetaId, cantidad, concepto, fecha } = body;

    if (!tarjetaId || !cantidad) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const pago = await prisma.pagoTarjeta.create({
      data: {
        tarjetaId: parseInt(tarjetaId),
        cantidad: parseFloat(cantidad),
        concepto: concepto || null,
        fecha: fecha ? new Date(fecha) : new Date(),
      },
      include: { tarjeta: true },
    });

    return Response.json(pago, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}
