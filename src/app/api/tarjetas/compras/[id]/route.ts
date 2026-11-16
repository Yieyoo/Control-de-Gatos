// src/app/api/tarjetas/compras/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { leerFecha, leerMontoPositivo, leerEnteroPositivo } from '@/lib/validacion';
import { calcularMontoMensualMSI } from '@/utils/finanzas';
import { CompraConPagosError } from '@/lib/finanzas';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      nombre,
      cantidad,
      fecha,
      categoriaId,
      notas,
      tipoPresupuesto,
      numeroMeses,
      apartadoQuincena1,
      apartadoQuincena2,
    } = body;

    const existente = await prisma.compraTarjeta.findUnique({
      where: { id: parseInt(id) },
      include: { devoluciones: true, pagos: true },
    });
    if (!existente) {
      return Response.json({ error: 'Compra no encontrada' }, { status: 404 });
    }
    if (cantidad !== undefined && !leerMontoPositivo(cantidad)) {
      return Response.json({ error: 'El importe debe ser mayor que cero' }, { status: 400 });
    }

    const cantidadFinal = cantidad !== undefined ? leerMontoPositivo(cantidad) : existente.cantidad;
    const numeroMesesFinal = numeroMeses !== undefined ? (numeroMeses === null || numeroMeses === '' ? null : leerEnteroPositivo(numeroMeses)) : existente.numeroMeses;
    const fechaFinal = fecha !== undefined ? leerFecha(fecha) : undefined;
    if (!cantidadFinal || (numeroMeses !== undefined && numeroMeses !== null && numeroMeses !== '' && !numeroMesesFinal) || (fecha !== undefined && !fechaFinal)) {
      return Response.json({ error: 'Datos de compra inválidos' }, { status: 400 });
    }
    const devoluciones = existente.devoluciones.reduce((s, d) => s + d.cantidad, 0);
    const pagos = existente.pagos.reduce((s, p) => s + p.cantidad, 0);
    if (cantidad !== undefined && cantidadFinal + 0.000001 < devoluciones + pagos) {
      return Response.json({ error: 'El importe no puede ser menor que pagos y devoluciones ya registrados' }, { status: 400 });
    }

    const seEditanApartados = apartadoQuincena1 !== undefined || apartadoQuincena2 !== undefined;
    const limpiarApartados = (cantidadFinal !== existente.cantidad || numeroMesesFinal !== existente.numeroMeses) && !seEditanApartados;
    let apartado1Final: number | null = limpiarApartados ? null : existente.apartadoQuincena1;
    let apartado2Final: number | null = limpiarApartados ? null : existente.apartadoQuincena2;
    if (seEditanApartados) {
      const apartado1 = Number(apartadoQuincena1);
      const apartado2 = Number(apartadoQuincena2);
      const mensualidad = numeroMesesFinal && numeroMesesFinal > 1
        ? calcularMontoMensualMSI(Math.max(0, cantidadFinal - devoluciones), numeroMesesFinal)
        : null;
      if (
        apartadoQuincena1 === undefined || apartadoQuincena2 === undefined ||
        !Number.isFinite(apartado1) || !Number.isFinite(apartado2) ||
        apartado1 < 0 || apartado2 < 0 || mensualidad === null ||
        Math.abs(apartado1 + apartado2 - mensualidad) > 0.011
      ) {
        return Response.json({ error: 'Los dos apartados deben sumar la mensualidad de la compra' }, { status: 400 });
      }
      apartado1Final = apartado1;
      apartado2Final = apartado2;
    }

    const compra = await prisma.compraTarjeta.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad !== undefined && { cantidad: cantidadFinal }),
        ...(fechaFinal && { fecha: fechaFinal }),
        ...(categoriaId !== undefined && { categoriaId: categoriaId ? parseInt(categoriaId) : null }),
        ...(notas !== undefined && { notas }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
        numeroMeses: numeroMesesFinal,
        montoMensual: numeroMesesFinal ? calcularMontoMensualMSI(cantidadFinal, numeroMesesFinal) : null,
        apartadoQuincena1: apartado1Final,
        apartadoQuincena2: apartado2Final,
      },
      include: { categoria: true, tarjeta: true },
    });

    return Response.json(compra);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar compra' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const compraId = leerEnteroPositivo(id);
    if (!compraId) return Response.json({ error: 'Compra no encontrada' }, { status: 404 });
    const resultado = await prisma.$transaction(async (tx) => {
      const compra = await tx.compraTarjeta.findUnique({
        where: { id: compraId },
        include: { _count: { select: { pagos: true } } },
      });
      if (!compra) return false;
      if (compra._count.pagos > 0) throw new CompraConPagosError();
      await tx.compraTarjeta.delete({ where: { id: compraId } });
      return true;
    }, { isolationLevel: 'Serializable' });
    if (!resultado) return Response.json({ error: 'Compra no encontrada' }, { status: 404 });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof CompraConPagosError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar compra' }, { status: 500 });
  }
}
