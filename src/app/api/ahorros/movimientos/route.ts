// src/app/api/ahorros/movimientos/route.ts
import { prisma } from '@/lib/prisma';
import { ajustarSaldoDisponible } from '@/lib/finanzas';

export async function GET() {
  try {
    const movimientos = await prisma.movimientoAhorro.findMany({
      include: { ahorro: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(movimientos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ahorroId, tipo, cantidad, concepto, fecha } = body;

    if (!ahorroId || !tipo || !cantidad || !concepto) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    if (tipo !== 'deposito' && tipo !== 'retiro') {
      return Response.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const monto = parseFloat(cantidad);
    const delta = tipo === 'retiro' ? -monto : monto;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoAhorro.create({
        data: {
          ahorroId: parseInt(ahorroId),
          tipo,
          cantidad: monto,
          concepto,
          fecha: fecha ? new Date(fecha) : new Date(),
        },
      }),
      prisma.ahorroLugar.update({
        where: { id: parseInt(ahorroId) },
        data: { saldoActual: { increment: delta } },
      }),
    ]);

    // Transferencia manual disponible<->ahorro: depósito sale del disponible, retiro regresa.
    await ajustarSaldoDisponible(-delta);

    return Response.json(movimiento, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}
