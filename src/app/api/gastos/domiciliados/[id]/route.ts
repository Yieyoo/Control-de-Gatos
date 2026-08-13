// src/app/api/gastos/domiciliados/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, categoriaId, fechaCobro, frecuencia, cuentaPago, activo, notas } = body;

    const gasto = await prisma.gastoDomiciliado.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad !== undefined && { cantidad: parseFloat(cantidad) }),
        ...(categoriaId && { categoriaId: parseInt(categoriaId) }),
        ...(fechaCobro && { fechaCobro: parseInt(fechaCobro) }),
        ...(frecuencia && { frecuencia }),
        ...(cuentaPago && { cuentaPago }),
        ...(activo !== undefined && { activo }),
        ...(notas !== undefined && { notas }),
      },
      include: { categoria: true },
    });

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar gasto domiciliado' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.gastoDomiciliado.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar gasto domiciliado' }, { status: 500 });
  }
}
