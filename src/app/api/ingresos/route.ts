// src/app/api/ingresos/route.ts
import { prisma } from '@/lib/prisma';
import type { Ingreso } from '@prisma/client';

export async function GET() {
  try {
    const ingresos = await prisma.ingreso.findMany({
      orderBy: { fechaCreacion: 'desc' },
    });
    return Response.json(ingresos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener ingresos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, frecuencia, activo = true, notas } = body;

    if (!nombre || !cantidad || !frecuencia) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const ingreso = await prisma.ingreso.create({
      data: {
        nombre,
        cantidad: parseFloat(cantidad),
        frecuencia,
        activo,
        notas,
        fechaInicio: new Date(),
      },
    });

    return Response.json(ingreso, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear ingreso' }, { status: 500 });
  }
}
