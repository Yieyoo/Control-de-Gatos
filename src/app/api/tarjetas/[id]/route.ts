// src/app/api/tarjetas/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, diaCorte, pagoQuincenal, activa, notas } = body;

    const tarjeta = await prisma.tarjetaCredito.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(diaCorte !== undefined && { diaCorte: parseInt(diaCorte) }),
        ...(pagoQuincenal !== undefined && { pagoQuincenal: pagoQuincenal ? parseFloat(pagoQuincenal) : null }),
        ...(activa !== undefined && { activa }),
        ...(notas !== undefined && { notas }),
      },
    });

    return Response.json(tarjeta);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar tarjeta' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.tarjetaCredito.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar tarjeta' }, { status: 500 });
  }
}
