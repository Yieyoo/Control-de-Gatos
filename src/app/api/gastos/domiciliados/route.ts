// src/app/api/gastos/domiciliados/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerMontoPositivo, validarDiasSemana } from '@/lib/validacion';

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
    const { nombre, cantidad, categoriaId, fechaCobro, frecuencia, diasSemana, cuentaPago, tarjetaId, tipoPresupuesto, notas } = body;
    const monto = leerMontoPositivo(cantidad);
    const categoriaIdFinal = leerEnteroPositivo(categoriaId);
    const tarjetaIdFinal = tarjetaId ? leerEnteroPositivo(tarjetaId) : null;
    const fechaCobroFinal = fechaCobro ? Number(fechaCobro) : null;

    if (!nombre || !monto || !categoriaIdFinal || !['mensual', 'quincenal', 'semanal'].includes(frecuencia) || !cuentaPago || (tarjetaId && !tarjetaIdFinal)) {
      return Response.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }
    if (frecuencia === 'semanal' && !validarDiasSemana(diasSemana)) {
      return Response.json({ error: 'Selecciona al menos un día de la semana' }, { status: 400 });
    }
    if (frecuencia !== 'semanal' && !fechaCobro) {
      return Response.json({ error: 'Falta el día de cobro' }, { status: 400 });
    }
    if (frecuencia !== 'semanal' && (!Number.isInteger(fechaCobroFinal) || fechaCobroFinal! < 1 || fechaCobroFinal! > 31)) {
      return Response.json({ error: 'El día de cobro debe estar entre 1 y 31' }, { status: 400 });
    }

    const gasto = await prisma.gastoDomiciliado.create({
      data: {
        nombre,
        cantidad: monto,
        categoriaId: categoriaIdFinal,
        fechaCobro: frecuencia === 'semanal' ? null : fechaCobroFinal,
        frecuencia,
        diasSemana: frecuencia === 'semanal' ? diasSemana : null,
        cuentaPago,
        tarjetaId: tarjetaIdFinal,
        tipoPresupuesto: tipoPresupuesto || null,
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
