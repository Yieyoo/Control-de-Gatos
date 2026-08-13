// src/app/api/gastos/domiciliados/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const gastos = await prisma.gastoDomiciliado.findMany({
      include: { categoria: true },
      orderBy: { fechaCobro: 'asc' },
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
    const { nombre, cantidad, categoriaId, fechaCobro, frecuencia, cuentaPago, notas } = body;

    if (!nombre || !cantidad || !categoriaId || !fechaCobro || !frecuencia || !cuentaPago) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const gasto = await prisma.gastoDomiciliado.create({
      data: {
        nombre,
        cantidad: parseFloat(cantidad),
        categoriaId: parseInt(categoriaId),
        fechaCobro: parseInt(fechaCobro),
        frecuencia,
        cuentaPago,
        notas,
      },
      include: { categoria: true },
    });

    return Response.json(gasto, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear gasto domiciliado' }, { status: 500 });
  }
}
