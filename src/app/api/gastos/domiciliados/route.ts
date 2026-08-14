// src/app/api/gastos/domiciliados/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const gastos = await prisma.gastoDomiciliado.findMany({
      include: { categoria: true, tarjeta: true },
      orderBy: { nombre: 'asc' },
    });
    return Response.json(gastos);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener gastos domiciliados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, categoriaId, fechaCobro, frecuencia, diasSemana, cuentaPago, tarjetaId, notas } = body;

    if (!nombre || !cantidad || !categoriaId || !frecuencia || !cuentaPago) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }
    if (frecuencia === 'semanal' && !diasSemana) {
      return Response.json({ error: 'Selecciona al menos un día de la semana' }, { status: 400 });
    }
    if (frecuencia !== 'semanal' && !fechaCobro) {
      return Response.json({ error: 'Falta el día de cobro' }, { status: 400 });
    }

    const gasto = await prisma.gastoDomiciliado.create({
      data: {
        nombre,
        cantidad: parseFloat(cantidad),
        categoriaId: parseInt(categoriaId),
        fechaCobro: frecuencia === 'semanal' ? null : parseInt(fechaCobro),
        frecuencia,
        diasSemana: frecuencia === 'semanal' ? diasSemana : null,
        cuentaPago,
        tarjetaId: tarjetaId ? parseInt(tarjetaId) : null,
        notas,
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(gasto, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear gasto domiciliado' }, { status: 500 });
  }
}
