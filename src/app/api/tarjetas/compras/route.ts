// src/app/api/tarjetas/compras/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { calcularMontoMensualMSI } from '@/utils/finanzas';
import { hoyMexico } from '@/utils/calculos';

export async function GET() {
  try {
    const compras = await prisma.compraTarjeta.findMany({
      include: { categoria: true, tarjeta: true, devoluciones: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(compras);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener compras' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, fecha, tarjetaId, categoriaId, notas, tipoPresupuesto, numeroMeses } = body;

    const cantidadFinal = leerMontoPositivo(cantidad);
    const tarjetaIdFinal = leerEnteroPositivo(tarjetaId);
    const numeroMesesFinal = numeroMeses == null || numeroMeses === '' ? null : leerEnteroPositivo(numeroMeses);
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();
    if (!nombre || !cantidadFinal || !tarjetaIdFinal || !fechaFinal || (numeroMeses != null && numeroMeses !== '' && !numeroMesesFinal)) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const compra = await prisma.compraTarjeta.create({
      data: {
        nombre,
        cantidad: cantidadFinal,
        fecha: fechaFinal,
        tarjetaId: tarjetaIdFinal,
        categoriaId: categoriaId ? parseInt(categoriaId) : null,
        notas,
        tipoPresupuesto: tipoPresupuesto || null,
        numeroMeses: numeroMesesFinal,
        montoMensual: numeroMesesFinal ? calcularMontoMensualMSI(cantidadFinal, numeroMesesFinal) : null,
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(compra, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear compra' }, { status: 500 });
  }
}
