// src/app/api/devoluciones/route.ts
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cantidad, fecha, concepto, gastoVariableId, compraTarjetaId } = body;

    if (!cantidad || (!gastoVariableId && !compraTarjetaId)) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const monto = parseFloat(cantidad);
    const devolucion = await prisma.devolucion.create({
      data: {
        cantidad: monto,
        fecha: fecha ? new Date(fecha) : new Date(),
        concepto: concepto || null,
        gastoVariableId: gastoVariableId ? parseInt(gastoVariableId) : null,
        compraTarjetaId: compraTarjetaId ? parseInt(compraTarjetaId) : null,
      },
    });

    return Response.json(devolucion, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar devolución' }, { status: 500 });
  }
}
