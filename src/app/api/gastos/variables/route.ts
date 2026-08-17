// src/app/api/gastos/variables/route.ts
import { prisma } from '@/lib/prisma';
import { crearGastoVariable, validarFuente } from '@/lib/finanzas';

export async function GET() {
  try {
    const gastos = await prisma.gastoVariable.findMany({
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
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
    const { nombre, cantidad, categoriaId, notas, tipoPresupuesto, fuente, ahorroLugarId, depositoTerceroId, fecha } = body;

    if (!nombre || !cantidad || !categoriaId) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const fuenteFinal = fuente || 'disponible';
    const errorFuente = validarFuente({
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? parseInt(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? parseInt(depositoTerceroId) : null,
      cantidad: parseFloat(cantidad),
    });
    if (errorFuente) {
      return Response.json({ error: errorFuente }, { status: 400 });
    }

    const gasto = await crearGastoVariable({
      nombre,
      cantidad: parseFloat(cantidad),
      categoriaId: parseInt(categoriaId),
      fecha: fecha ? new Date(fecha) : undefined,
      notas,
      tipoPresupuesto: tipoPresupuesto || null,
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? parseInt(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? parseInt(depositoTerceroId) : null,
    });

    return Response.json(gasto, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}
