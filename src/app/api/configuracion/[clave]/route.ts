// src/app/api/configuracion/[clave]/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clave: string }> }
) {
  try {
    const { clave } = await params;
    const config = await prisma.configuracion.findUnique({ where: { clave } });
    return Response.json({ clave, valor: config?.valor ?? null });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clave: string }> }
) {
  try {
    const { clave } = await params;
    const { valor } = await request.json();

    if (valor === undefined || valor === null) {
      return Response.json({ error: 'Falta el valor' }, { status: 400 });
    }

    const config = await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: String(valor) },
      update: { valor: String(valor) },
    });

    return Response.json(config);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
