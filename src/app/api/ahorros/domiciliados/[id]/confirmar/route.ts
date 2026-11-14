// src/app/api/ahorros/domiciliados/[id]/confirmar/route.ts
import { confirmarAhorroDomiciliado, deshacerAhorroDomiciliado } from '@/lib/finanzas';
import { leerEnteroPositivo, leerFecha } from '@/lib/validacion';

export async function POST(
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
    const movimiento = await confirmarAhorroDomiciliado(idFinal, fechaFinal);
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
    const idFinal = leerEnteroPositivo(id);
    const fechaFinal = leerFecha(fecha);
    if (!idFinal || !fechaFinal) {
      return Response.json({ error: 'Falta la fecha' }, { status: 400 });
    }
    await deshacerAhorroDomiciliado(idFinal, fechaFinal);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al deshacer el envío' }, { status: 500 });
  }
}
