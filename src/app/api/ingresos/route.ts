// src/app/api/ingresos/route.ts
import { prisma } from '@/lib/prisma';
import type { Ingreso } from '@prisma/client';
import { leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

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
    const { nombre, cantidad, frecuencia, activo = true, notas, fecha } = body;

    const monto = leerMontoPositivo(cantidad);
    const fechaInicio = fecha ? leerFecha(`${fecha}T12:00:00Z`) : hoyMexico();
    if (!nombre || !monto || !['mensual', 'quincenal', 'unico'].includes(frecuencia) || !fechaInicio) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const ingreso = await prisma.ingreso.create({
      data: {
        nombre,
        cantidad: monto,
        frecuencia,
        activo,
        notas,
        // "fecha" (YYYY-MM-DD) permite registrar un dinero extra que llegó
        // otro día (ej. el aguinaldo de ayer). Se guarda a mediodía UTC para
        // que la zona horaria no lo corra al día anterior.
        fechaInicio,
      },
    });

    return Response.json(ingreso, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear ingreso' }, { status: 500 });
  }
}
