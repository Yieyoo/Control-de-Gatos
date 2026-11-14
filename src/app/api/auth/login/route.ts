// src/app/api/auth/login/route.ts
import { contraseñaCorrecta, crearSessionToken, SESSION_COOKIE } from '@/lib/session';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

const MAX_INTENTOS = 8;
const VENTANA_MS = 15 * 60 * 1000;
const PREFIJO_CLAVE = 'login_rate_limit:';

async function actualizarLimite(ip: string, correcta: boolean) {
  const clave = `${PREFIJO_CLAVE}${createHash('sha256').update(ip).digest('hex')}`;
  const ahora = Date.now();
  return prisma.$transaction(async (tx) => {
    await tx.configuracion.deleteMany({
      where: { clave: { startsWith: PREFIJO_CLAVE }, fechaActualizacion: { lt: new Date(ahora - 30 * 24 * 60 * 60 * 1000) } },
    });
    const config = await tx.configuracion.findUnique({ where: { clave } });
    let estado = { intentos: 0, inicia: ahora, bloqueadoHasta: 0 };
    if (config) {
      try {
        const leido = JSON.parse(config.valor);
        if (Number.isFinite(leido.intentos) && Number.isFinite(leido.inicia) && Number.isFinite(leido.bloqueadoHasta)) {
          estado = leido;
        }
      } catch {
        // Si el dato está corrupto, se reinicia el contador de este IP.
      }
    }

    if (estado.bloqueadoHasta > ahora) return Math.ceil((estado.bloqueadoHasta - ahora) / 1000);
    if (ahora - estado.inicia >= VENTANA_MS) estado = { intentos: 0, inicia: ahora, bloqueadoHasta: 0 };
    if (correcta) {
      await tx.configuracion.deleteMany({ where: { clave } });
      return 0;
    }

    const intentos = estado.intentos + 1;
    const bloqueadoHasta = intentos >= MAX_INTENTOS ? ahora + VENTANA_MS : 0;
    const valor = JSON.stringify({ intentos, inicia: estado.inicia, bloqueadoHasta });
    await tx.configuracion.upsert({
      where: { clave },
      create: { clave, valor },
      update: { valor },
    });
    return bloqueadoHasta > ahora ? VENTANA_MS / 1000 : 0;
  }, { isolationLevel: 'Serializable' });
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const correcta = typeof password === 'string' && contraseñaCorrecta(password);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const bloqueadoPor = await actualizarLimite(ip, correcta);
    if (bloqueadoPor > 0) {
      return Response.json(
        { error: 'Demasiados intentos. Inténtalo más tarde.' },
        { status: 429, headers: { 'Retry-After': String(bloqueadoPor) } }
      );
    }
    if (!correcta) {
      return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const { token, maxAgeSegundos } = crearSessionToken();

    const respuesta = Response.json({ success: true });
    respuesta.headers.append(
      'Set-Cookie',
      [
        `${SESSION_COOKIE}=${token}`,
        'Path=/',
        `Max-Age=${maxAgeSegundos}`,
        'HttpOnly',
        'SameSite=Lax',
        ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
      ].join('; ')
    );
    return respuesta;
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
