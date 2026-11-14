// src/app/api/ahorros/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerSaldoNoNegativo } from '@/lib/validacion';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ahorro = await prisma.ahorroLugar.findUnique({
      where: { id: parseInt(id) },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, tipo, saldoActual, notas } = body;
    const saldo = saldoActual !== undefined ? leerSaldoNoNegativo(saldoActual) : undefined;
    if (saldoActual !== undefined && saldo === null) {
      return Response.json({ error: 'El saldo debe ser un número mayor o igual a cero' }, { status: 400 });
    }

    const ahorro = await prisma.ahorroLugar.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(tipo && { tipo }),
        ...(saldo !== undefined && { saldoActual: saldo }),
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.ahorroLugar.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar ahorro' }, { status: 500 });
  }
}
