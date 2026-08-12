// src/app/api/ahorros/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ahorros = await prisma.ahorroLugar.findMany({
      orderBy: { fechaCreacion: 'desc' },
    });
    return Response.json(ahorros);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener ahorros' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, tipo, saldoActual = 0, notas } = body;

    if (!nombre || !tipo) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const ahorro = await prisma.ahorroLugar.create({
      data: {
        nombre,
        tipo,
        saldoActual: parseFloat(saldoActual || 0),
        notas,
      },
    });

    return Response.json(ahorro, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear ahorro' }, { status: 500 });
  }
}
