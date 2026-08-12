// src/app/api/ingresos/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ingreso = await prisma.ingreso.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!ingreso) {
      return Response.json({ error: 'Ingreso no encontrado' }, { status: 404 });
    }

    return Response.json(ingreso);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener ingreso' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { nombre, cantidad, frecuencia, activo, notas } = body;

    const ingreso = await prisma.ingreso.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad && { cantidad: parseFloat(cantidad) }),
        ...(frecuencia && { frecuencia }),
        ...(activo !== undefined && { activo }),
        ...(notas && { notas }),
      },
    });

    return Response.json(ingreso);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar ingreso' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.ingreso.delete({
      where: { id: parseInt(params.id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar ingreso' }, { status: 500 });
  }
}
