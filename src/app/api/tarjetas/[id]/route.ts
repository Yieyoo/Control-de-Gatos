// src/app/api/tarjetas/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerSaldoNoNegativo, leerEnteroPositivo } from '@/lib/validacion';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, diaCorte, pagoQuincenal, activa, notas } = body;
    const dia = diaCorte !== undefined ? leerEnteroPositivo(diaCorte) : undefined;
    const pago = pagoQuincenal !== undefined ? (pagoQuincenal === null || pagoQuincenal === '' ? null : leerSaldoNoNegativo(pagoQuincenal)) : undefined;
    if ((diaCorte !== undefined && (!dia || dia > 31)) || (pagoQuincenal !== undefined && pagoQuincenal !== null && pagoQuincenal !== '' && pago === null)) {
      return Response.json({ error: 'Día de corte o pago quincenal inválido' }, { status: 400 });
    }

    const tarjeta = await prisma.tarjetaCredito.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(dia !== undefined && { diaCorte: dia }),
        ...(pago !== undefined && { pagoQuincenal: pago }),
        ...(activa !== undefined && { activa }),
        ...(notas !== undefined && { notas }),
      },
    });

    return Response.json(tarjeta);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar tarjeta' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.tarjetaCredito.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar tarjeta' }, { status: 500 });
  }
}
