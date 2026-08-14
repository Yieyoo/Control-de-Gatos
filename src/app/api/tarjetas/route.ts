// src/app/api/tarjetas/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const tarjetas = await prisma.tarjetaCredito.findMany({
      orderBy: { fechaCreacion: 'asc' },
    });
    return Response.json(tarjetas);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener tarjetas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, diaCorte, notas } = body;

    if (!nombre || !diaCorte) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const tarjeta = await prisma.tarjetaCredito.create({
      data: {
        nombre,
        diaCorte: parseInt(diaCorte),
        notas,
      },
    });

    return Response.json(tarjeta, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear tarjeta' }, { status: 500 });
  }
}
