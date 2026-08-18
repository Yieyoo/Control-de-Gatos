// src/app/api/devoluciones/[id]/route.ts
import { prisma } from '@/lib/prisma';

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

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar devolución' }, { status: 500 });
  }
}
