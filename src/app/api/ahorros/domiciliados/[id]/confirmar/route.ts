// src/app/api/ahorros/domiciliados/[id]/confirmar/route.ts
import { confirmarAhorroDomiciliado, deshacerAhorroDomiciliado } from '@/lib/finanzas';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { fecha } = await request.json();
    if (!fecha) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    const movimiento = await confirmarAhorroDomiciliado(parseInt(id), new Date(fecha));
    if (!movimiento) {
      return Response.json({ error: 'Ahorro domiciliado no encontrado' }, { status: 404 });
    }
    return Response.json(movimiento, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al confirmar el ahorro' }, { status: 500 });
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
    await deshacerAhorroDomiciliado(parseInt(id), new Date(fecha));
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al deshacer el envío' }, { status: 500 });
  }
}
