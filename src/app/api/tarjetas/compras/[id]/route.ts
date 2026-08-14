// src/app/api/tarjetas/compras/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, fecha, categoriaId, notas, tipoPresupuesto } = body;

    const compra = await prisma.compraTarjeta.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad !== undefined && { cantidad: parseFloat(cantidad) }),
        ...(fecha && { fecha: new Date(fecha) }),
        ...(categoriaId !== undefined && { categoriaId: categoriaId ? parseInt(categoriaId) : null }),
        ...(notas !== undefined && { notas }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(compra);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar compra' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.compraTarjeta.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar compra' }, { status: 500 });
  }
}
