// src/app/api/ahorros/movimientos/route.ts
import { prisma } from '@/lib/prisma';
import { FondosInsuficientesError } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

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

    const ahorroIdFinal = leerEnteroPositivo(ahorroId);
    const monto = leerMontoPositivo(cantidad);
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();
    if (!ahorroIdFinal || !monto || !concepto || !fechaFinal) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    if (tipo !== 'deposito' && tipo !== 'retiro') {
      return Response.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const movimiento = await prisma.$transaction(async (tx) => {
      const saldoCambio = tipo === 'retiro'
        ? await tx.ahorroLugar.updateMany({
            where: { id: ahorroIdFinal, saldoActual: { gte: monto } },
            data: { saldoActual: { decrement: monto } },
          })
        : await tx.ahorroLugar.updateMany({
            where: { id: ahorroIdFinal },
            data: { saldoActual: { increment: monto } },
          });
      if (!saldoCambio.count) throw new FondosInsuficientesError('La cuenta no existe o no tiene saldo suficiente');
      return tx.movimientoAhorro.create({
        data: {
          ahorroId: ahorroIdFinal,
          tipo,
          cantidad: monto,
          concepto,
          fecha: fechaFinal,
        },
      });
    });

    return Response.json(movimiento, { status: 201 });
  } catch (error) {
    if (error instanceof FondosInsuficientesError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}
