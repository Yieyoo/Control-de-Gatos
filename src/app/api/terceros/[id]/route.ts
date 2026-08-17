// src/app/api/terceros/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usos = await prisma.depositoTercero.findUnique({
      where: { id: parseInt(id) },
      include: { gastosVariables: true, pagosTarjeta: true },
    });
    if (usos && (usos.gastosVariables.length > 0 || usos.pagosTarjeta.length > 0)) {
      return Response.json(
        { error: 'No se puede eliminar: ya se usó este depósito en un gasto o pago. Bórralos primero.' },
        { status: 400 }
      );
    }

    await prisma.depositoTercero.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar depósito' }, { status: 500 });
  }
}
