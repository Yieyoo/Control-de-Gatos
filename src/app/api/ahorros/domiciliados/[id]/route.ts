// src/app/api/ahorros/domiciliados/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerMontoPositivo, validarDiasSemana } from '@/lib/validacion';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idFinal = leerEnteroPositivo(id);
    if (!idFinal) return Response.json({ error: 'Ahorro domiciliado no encontrado' }, { status: 404 });
    const body = await request.json();
    const { nombre, cantidad, frecuencia, diasSemana, ahorroDestinoId, obligatorio, activo, notas } = body;
    const monto = cantidad !== undefined ? leerMontoPositivo(cantidad) : undefined;
    const destino = ahorroDestinoId !== undefined ? leerEnteroPositivo(ahorroDestinoId) : undefined;
    const existente = await prisma.ahorroDomiciliado.findUnique({
      where: { id: idFinal },
      select: { frecuencia: true, diasSemana: true },
    });
    if (!existente) return Response.json({ error: 'Ahorro domiciliado no encontrado' }, { status: 404 });
    const frecuenciaFinal = frecuencia ?? existente.frecuencia;
    const diasSemanaFinal = diasSemana !== undefined ? diasSemana : existente.diasSemana;
    if ((cantidad !== undefined && !monto) || (ahorroDestinoId !== undefined && !destino) ||
      (frecuencia !== undefined && !['mensual', 'quincenal', 'semanal'].includes(frecuencia)) ||
      (frecuenciaFinal === 'semanal' && !validarDiasSemana(diasSemanaFinal))) {
      return Response.json({ error: 'Datos de ahorro domiciliado inválidos' }, { status: 400 });
    }

    const ahorro = await prisma.ahorroDomiciliado.update({
      where: { id: idFinal },
      data: {
        ...(nombre && { nombre }),
        ...(monto !== undefined && { cantidad: monto }),
        ...(frecuencia && { frecuencia }),
        ...(diasSemana !== undefined && { diasSemana }),
        ...(destino !== undefined && { ahorroDestinoId: destino }),
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
