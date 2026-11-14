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

    if (clave === 'porcentajes_destino') {
      if (typeof valor !== 'string') {
        return Response.json({ error: 'El formato de porcentajes no es válido' }, { status: 400 });
      }
      let porcentajes: unknown;
      try {
        porcentajes = JSON.parse(valor);
      } catch {
        return Response.json({ error: 'El formato de porcentajes no es válido' }, { status: 400 });
      }
      const p = porcentajes as { necesidades?: unknown; gustos?: unknown; ahorro?: unknown };
      const valores = [p?.necesidades, p?.gustos, p?.ahorro];
      if (!valores.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) ||
        Math.abs((valores as number[]).reduce((s, v) => s + v, 0) - 100) >= 0.01) {
        return Response.json({ error: 'Los porcentajes deben ser válidos y sumar 100' }, { status: 400 });
      }
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
