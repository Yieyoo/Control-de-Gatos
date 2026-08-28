// src/app/api/ahorros/domiciliados/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, frecuencia, diasSemana, ahorroDestinoId, obligatorio, activo, notas } = body;

    const ahorro = await prisma.ahorroDomiciliado.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad !== undefined && { cantidad: parseFloat(cantidad) }),
        ...(frecuencia && { frecuencia }),
        ...(diasSemana !== undefined && { diasSemana }),
        ...(ahorroDestinoId && { ahorroDestinoId: parseInt(ahorroDestinoId) }),
        ...(obligatorio !== undefined && { obligatorio }),
        ...(activo !== undefined && { activo }),
        ...(notas !== undefined && { notas }),
      },
      include: { ahorroDestino: true },
    });

    return Response.json(ahorro);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar ahorro domiciliado' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.ahorroDomiciliado.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar ahorro domiciliado' }, { status: 500 });
  }
}
