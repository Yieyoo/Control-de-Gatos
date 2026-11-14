// src/app/api/tarjetas/pagos/route.ts
import { prisma } from '@/lib/prisma';
import { crearPagoTarjeta, validarFuente, FondosInsuficientesError, CompraTarjetaInvalidaError } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

export async function GET() {
  try {
    const pagos = await prisma.pagoTarjeta.findMany({
      include: { tarjeta: true, ahorroLugar: true, depositoTercero: true, compraTarjeta: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(pagos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tarjetaId, cantidad, concepto, fecha, fuente, ahorroLugarId, depositoTerceroId, compraTarjetaId } = body;
    const tarjetaIdFinal = leerEnteroPositivo(tarjetaId);
    const cantidadFinal = leerMontoPositivo(cantidad);
    const ahorroLugarIdFinal = ahorroLugarId ? leerEnteroPositivo(ahorroLugarId) : null;
    const depositoTerceroIdFinal = depositoTerceroId ? leerEnteroPositivo(depositoTerceroId) : null;
    const compraTarjetaIdFinal = compraTarjetaId ? leerEnteroPositivo(compraTarjetaId) : null;
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();

    if (!tarjetaIdFinal || !cantidadFinal || (ahorroLugarId && !ahorroLugarIdFinal) || (depositoTerceroId && !depositoTerceroIdFinal) || (compraTarjetaId && !compraTarjetaIdFinal) || (fecha && !fechaFinal)) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const fuenteFinal = fuente || 'disponible';
    const errorFuente = validarFuente({
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarIdFinal,
      depositoTerceroId: depositoTerceroIdFinal,
      cantidad: cantidadFinal,
    });
    if (errorFuente) {
      return Response.json({ error: errorFuente }, { status: 400 });
    }

    const pago = await crearPagoTarjeta({
      tarjetaId: tarjetaIdFinal,
      cantidad: cantidadFinal,
      concepto: concepto || null,
      fecha: fechaFinal ?? undefined,
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarIdFinal,
      depositoTerceroId: depositoTerceroIdFinal,
      compraTarjetaId: compraTarjetaIdFinal,
    });

    return Response.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof FondosInsuficientesError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CompraTarjetaInvalidaError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}
