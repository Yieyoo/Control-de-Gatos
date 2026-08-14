// src/app/api/tarjetas/pagos/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.pagoTarjeta.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
