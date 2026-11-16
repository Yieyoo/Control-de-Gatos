// src/app/api/gastos/domiciliados/[id]/confirmar/route.ts
import { confirmarGastoDomiciliado, deshacerGastoDomiciliado, CompraConPagosError } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha, leerMontoPositivo } from '@/lib/validacion';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { fecha, monto, pagarDesdeDisponible } = await request.json();
    const idFinal = leerEnteroPositivo(id);
    const fechaFinal = leerFecha(fecha);
    if (!idFinal || !fechaFinal) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    const montoRealLeido = monto !== undefined && monto !== null && monto !== '' ? leerMontoPositivo(monto) : null;
    if (monto !== undefined && monto !== null && monto !== '' && !montoRealLeido) {
      return Response.json({ error: 'Monto inválido' }, { status: 400 });
    }
    const montoReal = montoRealLeido ?? undefined;
    const gasto = await confirmarGastoDomiciliado(idFinal, fechaFinal, montoReal, pagarDesdeDisponible === true);
    if (!gasto) {
      return Response.json({ error: 'Gasto domiciliado no encontrado' }, { status: 404 });
    }
    return Response.json(gasto, { status: 201 });
  } catch (error) {
    if (error instanceof CompraConPagosError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al confirmar el gasto' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { fecha } = await request.json();
    const idFinal = leerEnteroPositivo(id);
    const fechaFinal = leerFecha(fecha);
    if (!idFinal || !fechaFinal) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    await deshacerGastoDomiciliado(idFinal, fechaFinal);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof CompraConPagosError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error('Error:', error);
    return Response.json({ error: 'Error al deshacer el gasto' }, { status: 500 });
  }
}
