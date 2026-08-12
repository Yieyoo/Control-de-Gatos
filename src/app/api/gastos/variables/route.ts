// src/app/api/gastos/variables/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const gastos = await prisma.gastoVariable.findMany({
      include: { categoria: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(gastos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, categoriaId, notas } = body;

    if (!nombre || !cantidad || !categoriaId) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const gasto = await prisma.gastoVariable.create({
      data: {
        nombre,
        cantidad: parseFloat(cantidad),
        categoriaId: parseInt(categoriaId),
        notas,
        fecha: new Date(),
      },
      include: { categoria: true },
    });

    return Response.json(gasto, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}
