// src/app/api/categorias/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: [{ esDelSistema: 'desc' }, { nombre: 'asc' }],
    });
    return Response.json(categorias);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, color = '#3b82f6', icono } = body;

    if (!nombre) {
      return Response.json(
        { error: 'Falta el nombre de la categoría' },
        { status: 400 }
      );
    }

    const categoria = await prisma.categoria.create({
      data: {
        nombre,
        color,
        icono,
        esDelSistema: false,
      },
    });

    return Response.json(categoria, { status: 201 });
  } catch (error: any) {
    console.error('Error:', error);
    if (error.code === 'P2002') {
      return Response.json(
        { error: 'La categoría ya existe' },
        { status: 400 }
      );
    }
    return Response.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}
