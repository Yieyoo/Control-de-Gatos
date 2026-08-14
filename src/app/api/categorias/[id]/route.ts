// src/app/api/categorias/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, color, icono, tipoPresupuesto } = body;

    if (tipoPresupuesto !== undefined && tipoPresupuesto !== null && tipoPresupuesto !== 'necesidad' && tipoPresupuesto !== 'gusto') {
      return Response.json({ error: 'tipoPresupuesto inválido' }, { status: 400 });
    }

    const categoria = await prisma.categoria.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(color && { color }),
        ...(icono !== undefined && { icono }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto }),
      },
    });

    return Response.json(categoria);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}
