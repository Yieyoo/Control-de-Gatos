// src/app/api/ahorros/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ahorro = await prisma.ahorroLugar.findUnique({
      where: { id: parseInt(params.id) },
      include: { movimientos: true },
    });

    if (!ahorro) {
      return Response.json({ error: 'Ahorro no encontrado' }, { status: 404 });
    }

    return Response.json(ahorro);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener ahorro' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { nombre, tipo, saldoActual, notas } = body;

    const ahorro = await prisma.ahorroLugar.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(nombre && { nombre }),
        ...(tipo && { tipo }),
        ...(saldoActual !== undefined && { saldoActual: parseFloat(saldoActual) }),
        ...(notas && { notas }),
      },
    });

    return Response.json(ahorro);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar ahorro' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.ahorroLugar.delete({
      where: { id: parseInt(params.id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar ahorro' }, { status: 500 });
  }
}
