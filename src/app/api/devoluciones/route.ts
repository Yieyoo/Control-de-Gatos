// src/app/api/devoluciones/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cantidad, fecha, concepto, gastoVariableId, compraTarjetaId } = body;
    const monto = leerMontoPositivo(cantidad);
    const gastoId = gastoVariableId ? leerEnteroPositivo(gastoVariableId) : null;
    const compraId = compraTarjetaId ? leerEnteroPositivo(compraTarjetaId) : null;
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();
    if (!monto || (!!gastoVariableId && !gastoId) || (!!compraTarjetaId && !compraId) || (!!gastoId === !!compraId) || !fechaFinal) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const item = gastoId
        ? await tx.gastoVariable.findUnique({ where: { id: gastoId }, include: { devoluciones: true } })
        : await tx.compraTarjeta.findUnique({ where: { id: compraId! }, include: { devoluciones: true } });
      if (!item) return { status: 404 as const, error: 'No se encontró el movimiento' };
      const restante = Math.max(0, item.cantidad - item.devoluciones.reduce((s, d) => s + d.cantidad, 0));
      if (monto > restante + 0.000001) {
        return { status: 400 as const, error: 'La devolución supera el importe pendiente del movimiento' };
      }
      const devolucion = await tx.devolucion.create({
        data: {
          cantidad: monto,
          fecha: fechaFinal,
          concepto: concepto || null,
          gastoVariableId: gastoId,
          compraTarjetaId: compraId,
        },
      });
      return { status: 201 as const, devolucion };
    }, { isolationLevel: 'Serializable' });

    return 'devolucion' in resultado
      ? Response.json(resultado.devolucion, { status: resultado.status })
      : Response.json({ error: resultado.error }, { status: resultado.status });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar devolución' }, { status: 500 });
  }
}
