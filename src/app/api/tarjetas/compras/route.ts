// src/app/api/tarjetas/compras/route.ts
import { prisma } from '@/lib/prisma';

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

    if (!nombre || !cantidad || !tarjetaId) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const cantidadFinal = parseFloat(cantidad);
    const numeroMesesFinal = numeroMeses ? parseInt(numeroMeses) : null;

    const compra = await prisma.compraTarjeta.create({
      data: {
        nombre,
        cantidad: cantidadFinal,
        fecha: fecha ? new Date(fecha) : new Date(),
        tarjetaId: parseInt(tarjetaId),
        categoriaId: categoriaId ? parseInt(categoriaId) : null,
        notas,
        tipoPresupuesto: tipoPresupuesto || null,
        numeroMeses: numeroMesesFinal,
        montoMensual: numeroMesesFinal ? cantidadFinal / numeroMesesFinal : null,
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(compra, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear compra' }, { status: 500 });
  }
}
