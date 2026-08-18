// src/app/api/devoluciones/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { ajustarSaldoDisponible } from '@/lib/finanzas';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const devolucion = await prisma.devolucion.findUnique({ where: { id: parseInt(id) } });
    if (!devolucion) {
      return Response.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    await prisma.devolucion.delete({ where: { id: parseInt(id) } });

    // Revertir el efecto sobre el disponible si venía de un gasto pagado con él.
    if (devolucion.gastoVariableId) {
      const gasto = await prisma.gastoVariable.findUnique({ where: { id: devolucion.gastoVariableId } });
      if (gasto?.fuente === 'disponible') await ajustarSaldoDisponible(-devolucion.cantidad);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar devolución' }, { status: 500 });
  }
}
