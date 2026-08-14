// src/app/api/gastos/domiciliados/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      nombre,
      cantidad,
      categoriaId,
      fechaCobro,
      frecuencia,
      diasSemana,
      cuentaPago,
      tarjetaId,
      pagadoAdelantadoHasta,
      activo,
      notas,
    } = body;

    const gasto = await prisma.gastoDomiciliado.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad !== undefined && { cantidad: parseFloat(cantidad) }),
        ...(categoriaId && { categoriaId: parseInt(categoriaId) }),
        ...(fechaCobro !== undefined && { fechaCobro: fechaCobro ? parseInt(fechaCobro) : null }),
        ...(frecuencia && { frecuencia }),
        ...(diasSemana !== undefined && { diasSemana }),
        ...(cuentaPago && { cuentaPago }),
        ...(tarjetaId !== undefined && { tarjetaId: tarjetaId ? parseInt(tarjetaId) : null }),
        ...(pagadoAdelantadoHasta !== undefined && {
          pagadoAdelantadoHasta: pagadoAdelantadoHasta ? new Date(pagadoAdelantadoHasta) : null,
        }),
        ...(activo !== undefined && { activo }),
        ...(notas !== undefined && { notas }),
      },
      include: { categoria: true, tarjeta: true },
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
