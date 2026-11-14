// src/app/api/gastos/variables/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { eliminarGastoVariable } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';

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
    const { nombre, cantidad, categoriaId, notas, tipoPresupuesto, fecha } = body;
    const monto = cantidad !== undefined ? leerMontoPositivo(cantidad) : undefined;
    const categoriaIdFinal = categoriaId !== undefined ? leerEnteroPositivo(categoriaId) : undefined;
    const fechaFinal = fecha !== undefined ? leerFecha(fecha) : undefined;
    if ((cantidad !== undefined && !monto) || (categoriaId !== undefined && !categoriaIdFinal) || (fecha !== undefined && !fechaFinal)) {
      return Response.json({ error: 'Datos de gasto inválidos' }, { status: 400 });
    }

    const existente = await prisma.gastoVariable.findUnique({ where: { id: parseInt(id) }, include: { devoluciones: true } });
    if (!existente) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }
    const totalDevuelto = existente.devoluciones.reduce((s, d) => s + d.cantidad, 0);
    if (monto != null && monto + 0.000001 < totalDevuelto) {
      return Response.json({ error: 'El importe no puede ser menor que las devoluciones ya registradas' }, { status: 400 });
    }
    // Si el dinero salió de un ahorro o de un depósito de tercero, cambiar la cantidad
    // dejaría desincronizado el retiro/el uso ya registrado -- hay que borrar y
    // volver a crear el gasto en ese caso, en vez de editarlo.
    if (existente.fuente !== 'disponible' && monto !== undefined && monto !== existente.cantidad) {
      return Response.json(
        { error: 'No se puede cambiar la cantidad de un gasto pagado con ahorro o dinero de terceros. Bórralo y créalo de nuevo.' },
        { status: 400 }
      );
    }

    const gasto = await prisma.gastoVariable.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(monto !== undefined && { cantidad: monto }),
        ...(categoriaIdFinal !== undefined && { categoriaId: categoriaIdFinal }),
        ...(notas && { notas }),
        ...(tipoPresupuesto !== undefined && { tipoPresupuesto: tipoPresupuesto || null }),
        ...(fechaFinal && { fecha: fechaFinal }),
      },
      include: { categoria: true, ahorroLugar: true, depositoTercero: true, devoluciones: true },
    });

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
