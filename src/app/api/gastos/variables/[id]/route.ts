// src/app/api/gastos/variables/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gasto = await prisma.gastoVariable.findUnique({
      where: { id: parseInt(id) },
      include: { categoria: true },
    });

    if (!gasto) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener gasto' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, categoriaId, notas, tipoPresupuesto } = body;

    const gasto = await prisma.gastoVariable.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad && { cantidad: parseFloat(cantidad) }),
        ...(categoriaId && { categoriaId: parseInt(categoriaId) }),
        ...(notas && { notas }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
      },
      include: { categoria: true },
    });

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.gastoVariable.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
