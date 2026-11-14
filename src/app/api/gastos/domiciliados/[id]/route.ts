// src/app/api/gastos/domiciliados/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo, validarDiasSemana } from '@/lib/validacion';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idFinal = leerEnteroPositivo(id);
    if (!idFinal) return Response.json({ error: 'Gasto domiciliado no encontrado' }, { status: 404 });
    const body = await request.json();
    const {
      nombre,
      cantidad,
      categoriaId,
      fechaCobro,
      frecuencia,
      diasSemana,
      cuentaPago,
      tarjetaId,
      pagadoAdelantadoHasta,
      tipoPresupuesto,
      activo,
      notas,
    } = body;
    const monto = cantidad !== undefined ? leerMontoPositivo(cantidad) : undefined;
    const categoriaIdFinal = categoriaId !== undefined ? leerEnteroPositivo(categoriaId) : undefined;
    const tarjetaIdFinal = tarjetaId !== undefined && tarjetaId !== null && tarjetaId !== '' ? leerEnteroPositivo(tarjetaId) : null;
    const fechaCobroFinal = fechaCobro !== undefined && fechaCobro !== null && fechaCobro !== '' ? Number(fechaCobro) : null;
    const pagadoHastaFinal = pagadoAdelantadoHasta ? leerFecha(pagadoAdelantadoHasta) : null;
    const existente = await prisma.gastoDomiciliado.findUnique({
      where: { id: idFinal },
      select: { frecuencia: true, diasSemana: true, fechaCobro: true },
    });
    if (!existente) return Response.json({ error: 'Gasto domiciliado no encontrado' }, { status: 404 });
    const frecuenciaFinal = frecuencia ?? existente.frecuencia;
    const diasSemanaFinal = diasSemana !== undefined ? diasSemana : existente.diasSemana;
    const diaCobroFinal = fechaCobro !== undefined ? fechaCobroFinal : existente.fechaCobro;
    if ((cantidad !== undefined && !monto) || (categoriaId !== undefined && !categoriaIdFinal) || (tarjetaId && !tarjetaIdFinal)) {
      return Response.json({ error: 'Datos de gasto domiciliado inválidos' }, { status: 400 });
    }
    if (frecuencia !== undefined && !['mensual', 'quincenal', 'semanal'].includes(frecuencia)) {
      return Response.json({ error: 'Frecuencia inválida' }, { status: 400 });
    }
    if (frecuenciaFinal === 'semanal' && !validarDiasSemana(diasSemanaFinal)) {
      return Response.json({ error: 'Selecciona días de la semana válidos' }, { status: 400 });
    }
    if (frecuenciaFinal !== 'semanal' && (!Number.isInteger(diaCobroFinal) || diaCobroFinal === null || diaCobroFinal < 1 || diaCobroFinal > 31)) {
      return Response.json({ error: 'El día de cobro debe estar entre 1 y 31' }, { status: 400 });
    }
    if (pagadoAdelantadoHasta && !pagadoHastaFinal) {
      return Response.json({ error: 'La fecha de pago adelantado no es válida' }, { status: 400 });
    }

    const gasto = await prisma.gastoDomiciliado.update({
      where: { id: idFinal },
      data: {
        ...(nombre && { nombre }),
        ...(monto !== undefined && { cantidad: monto }),
        ...(categoriaIdFinal !== undefined && { categoriaId: categoriaIdFinal }),
        ...(fechaCobro !== undefined && { fechaCobro: fechaCobroFinal }),
        ...(frecuencia && { frecuencia }),
        ...(diasSemana !== undefined && { diasSemana }),
        ...(cuentaPago && { cuentaPago }),
        ...(tarjetaId !== undefined && { tarjetaId: tarjetaIdFinal }),
        ...(pagadoAdelantadoHasta !== undefined && {
          pagadoAdelantadoHasta: pagadoHastaFinal,
        }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
        ...(activo !== undefined && { activo }),
        ...(notas !== undefined && { notas }),
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar gasto domiciliado' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.gastoDomiciliado.delete({
      where: { id: parseInt(id) },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar gasto domiciliado' }, { status: 500 });
  }
}
