// src/app/api/ahorros/domiciliados/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ahorros = await prisma.ahorroDomiciliado.findMany({
      include: { ahorroDestino: true },
      orderBy: { fechaCreacion: 'desc' },
    });
    return Response.json(ahorros);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener ahorros domiciliados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, frecuencia, diasSemana, ahorroDestinoId, obligatorio, notas } = body;

    if (!nombre || !cantidad || !frecuencia || !ahorroDestinoId) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }
    if (frecuencia === 'semanal' && !diasSemana) {
      return Response.json({ error: 'Selecciona al menos un día de la semana' }, { status: 400 });
    }

    const ahorro = await prisma.ahorroDomiciliado.create({
      data: {
        nombre,
        cantidad: parseFloat(cantidad),
        frecuencia,
        diasSemana: frecuencia === 'semanal' ? diasSemana : null,
        ahorroDestinoId: parseInt(ahorroDestinoId),
        obligatorio: obligatorio ?? true,
        notas,
      },
      include: { ahorroDestino: true },
    });

    return Response.json(ahorro, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear ahorro domiciliado' }, { status: 500 });
  }
}
