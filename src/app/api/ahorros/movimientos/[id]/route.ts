// src/app/api/ahorros/movimientos/[id]/route.ts
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const movimiento = await prisma.movimientoAhorro.findUnique({ where: { id: parseInt(id) } });

    if (!movimiento) {
      return Response.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }
    if (movimiento.origen === 'pago_gasto' || movimiento.origen === 'pago_tarjeta') {
      return Response.json(
        { error: 'Este movimiento viene de un gasto o pago de tarjeta. Bórralo desde ahí.' },
        { status: 400 }
      );
    }

    // Revertir el efecto del movimiento sobre el saldo antes de borrarlo.
    const delta = movimiento.tipo === 'retiro' ? movimiento.cantidad : -movimiento.cantidad;

    await prisma.$transaction([
      prisma.movimientoAhorro.delete({ where: { id: movimiento.id } }),
      prisma.ahorroLugar.update({
        where: { id: movimiento.ahorroId },
        data: { saldoActual: { increment: delta } },
      }),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar movimiento' }, { status: 500 });
  }
}
