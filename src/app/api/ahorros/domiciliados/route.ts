// src/app/api/ahorros/domiciliados/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerMontoPositivo, validarDiasSemana } from '@/lib/validacion';

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
    const monto = leerMontoPositivo(cantidad);
    const destino = leerEnteroPositivo(ahorroDestinoId);

    if (!nombre || !monto || !['mensual', 'quincenal', 'semanal'].includes(frecuencia) || !destino) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }
    if (frecuencia === 'semanal' && !validarDiasSemana(diasSemana)) {
      return Response.json({ error: 'Selecciona al menos un día de la semana' }, { status: 400 });
    }

    const ahorro = await prisma.ahorroDomiciliado.create({
      data: {
        nombre,
        cantidad: monto,
        frecuencia,
        diasSemana: frecuencia === 'semanal' ? diasSemana : null,
        ahorroDestinoId: destino,
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
