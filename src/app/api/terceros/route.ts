// src/app/api/terceros/route.ts
import { prisma } from '@/lib/prisma';
import { montoUtilizadoDeposito } from '@/lib/finanzas';
import { calcularEstadoDeposito } from '@/utils/finanzas';
import { leerFecha, leerMontoPositivo } from '@/lib/validacion';
import { hoyMexico } from '@/utils/calculos';

export async function GET() {
  try {
    const depositos = await prisma.depositoTercero.findMany({
      include: { gastosVariables: { include: { devoluciones: true } }, pagosTarjeta: true },
      orderBy: { fecha: 'desc' },
    });

    const conEstado = depositos.map((d) => {
      const montoUtilizado = montoUtilizadoDeposito(d);
      const { pendiente, estado } = calcularEstadoDeposito(d.cantidad, montoUtilizado);
      const usos = [
        ...d.gastosVariables.map((g) => ({ nombre: g.nombre, cantidad: g.cantidad, fecha: g.fecha })),
        ...d.pagosTarjeta.map((p) => ({ nombre: p.concepto || 'Pago de tarjeta', cantidad: p.cantidad, fecha: p.fecha })),
      ];
      return {
        id: d.id,
        persona: d.persona,
        cantidad: d.cantidad,
        concepto: d.concepto,
        fecha: d.fecha,
        pagoRelacionado: d.pagoRelacionado,
        notas: d.notas,
        montoUtilizado,
        pendiente,
        estado,
        usos,
      };
    });

    return Response.json(conEstado);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al obtener depósitos de terceros' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { persona, cantidad, concepto, fecha, pagoRelacionado, notas } = body;
    const monto = leerMontoPositivo(cantidad);
    const fechaFinal = fecha ? leerFecha(fecha) : hoyMexico();

    if (!persona || !monto || !concepto || !fechaFinal) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const deposito = await prisma.depositoTercero.create({
      data: {
        persona,
        cantidad: monto,
        concepto,
        fecha: fechaFinal,
        pagoRelacionado: pagoRelacionado || null,
        notas: notas || null,
      },
    });

    return Response.json({ ...deposito, montoUtilizado: 0, pendiente: deposito.cantidad, estado: 'pendiente' }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al crear depósito' }, { status: 500 });
  }
}
