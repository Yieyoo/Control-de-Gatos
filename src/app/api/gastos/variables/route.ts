// src/app/api/gastos/variables/route.ts
import { prisma } from '@/lib/prisma';
import { crearGastoVariable, validarFuente, FondosInsuficientesError } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

export async function GET() {
  try {
    const gastos = await prisma.gastoVariable.findMany({
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
      orderBy: { fecha: 'desc' },
    });
    return Response.json(gastos);
  } catch (error) {
    if (error instanceof FondosInsuficientesError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, cantidad, categoriaId, notas, tipoPresupuesto, fuente, ahorroLugarId, depositoTerceroId, fecha } = body;

    const monto = leerMontoPositivo(cantidad);
    const categoriaIdFinal = leerEnteroPositivo(categoriaId);
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();
    if (!nombre || !monto || !categoriaIdFinal || (fecha && !fechaFinal)) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const fuenteFinal = fuente || 'disponible';
    const errorFuente = validarFuente({
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? leerEnteroPositivo(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? leerEnteroPositivo(depositoTerceroId) : null,
      cantidad: monto,
    });
    if (errorFuente) {
      return Response.json({ error: errorFuente }, { status: 400 });
    }

    const gasto = await crearGastoVariable({
      nombre,
      cantidad: monto,
      categoriaId: categoriaIdFinal,
      fecha: fechaFinal ?? undefined,
      notas,
      tipoPresupuesto: tipoPresupuesto || null,
      fuente: fuenteFinal,
      ahorroLugarId: ahorroLugarId ? leerEnteroPositivo(ahorroLugarId) : null,
      depositoTerceroId: depositoTerceroId ? leerEnteroPositivo(depositoTerceroId) : null,
    });

    return Response.json(gasto, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}
