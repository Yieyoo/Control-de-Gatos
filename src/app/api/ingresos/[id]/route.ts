// src/app/api/ingresos/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerFecha, leerMontoPositivo } from '@/lib/validacion';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ingreso = await prisma.ingreso.findUnique({
      where: { id: parseInt(id) },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, frecuencia, activo, notas, fecha } = body;
    const monto = cantidad !== undefined ? leerMontoPositivo(cantidad) : undefined;
    const fechaInicio = fecha !== undefined ? leerFecha(`${fecha}T12:00:00Z`) : undefined;
    if ((cantidad !== undefined && !monto) || (frecuencia !== undefined && !['mensual', 'quincenal', 'unico'].includes(frecuencia)) || (fecha !== undefined && !fechaInicio)) {
      return Response.json({ error: 'Datos de ingreso inválidos' }, { status: 400 });
    }

    const ingreso = await prisma.ingreso.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(monto !== undefined && { cantidad: monto }),
        ...(frecuencia && { frecuencia }),
        ...(activo !== undefined && { activo }),
        ...(notas !== undefined && { notas }),
        ...(fechaInicio && { fechaInicio }),
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.ingreso.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar ingreso' }, { status: 500 });
  }
}
