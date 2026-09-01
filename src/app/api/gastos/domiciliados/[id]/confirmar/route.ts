// src/app/api/gastos/domiciliados/[id]/confirmar/route.ts
import { confirmarGastoDomiciliado, deshacerGastoDomiciliado } from '@/lib/finanzas';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { fecha, monto } = await request.json();
    if (!fecha) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    const montoReal = monto !== undefined && monto !== null && monto !== '' ? parseFloat(monto) : undefined;
    if (montoReal !== undefined && (!Number.isFinite(montoReal) || montoReal <= 0)) {
      return Response.json({ error: 'Monto inválido' }, { status: 400 });
    }
    const gasto = await confirmarGastoDomiciliado(parseInt(id), new Date(fecha), montoReal);
    if (!gasto) {
      return Response.json({ error: 'Gasto domiciliado no encontrado' }, { status: 404 });
    }
    return Response.json(gasto, { status: 201 });
  } catch (error) {
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
    if (!fecha) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    await deshacerGastoDomiciliado(parseInt(id), new Date(fecha));
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al deshacer el gasto' }, { status: 500 });
  }
}
