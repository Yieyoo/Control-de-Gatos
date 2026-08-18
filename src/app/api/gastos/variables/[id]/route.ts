// src/app/api/gastos/variables/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { eliminarGastoVariable, ajustarSaldoDisponible } from '@/lib/finanzas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gasto = await prisma.gastoVariable.findUnique({
      where: { id: parseInt(id) },
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
    });

    if (!gasto) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener gasto' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidad, categoriaId, notas, tipoPresupuesto } = body;

    const existente = await prisma.gastoVariable.findUnique({ where: { id: parseInt(id) } });
    if (!existente) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }
    // Si el dinero salió de un ahorro o de un depósito de tercero, cambiar la cantidad
    // dejaría desincronizado el retiro/el uso ya registrado -- hay que borrar y
    // volver a crear el gasto en ese caso, en vez de editarlo.
    if (existente.fuente !== 'disponible' && cantidad !== undefined && parseFloat(cantidad) !== existente.cantidad) {
      return Response.json(
        { error: 'No se puede cambiar la cantidad de un gasto pagado con ahorro o dinero de terceros. Bórralo y créalo de nuevo.' },
        { status: 400 }
      );
    }

    const gasto = await prisma.gastoVariable.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(cantidad && { cantidad: parseFloat(cantidad) }),
        ...(categoriaId && { categoriaId: parseInt(categoriaId) }),
        ...(notas && { notas }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
      },
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
    });

    // Si cambió la cantidad de un gasto pagado con dinero disponible, ajustar
    // el saldo por la diferencia (más gasto = resta más; menos gasto = regresa).
    if (existente.fuente === 'disponible' && cantidad !== undefined) {
      const diferencia = existente.cantidad - parseFloat(cantidad);
      if (diferencia !== 0) await ajustarSaldoDisponible(diferencia);
    }

    return Response.json(gasto);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await eliminarGastoVariable(parseInt(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
