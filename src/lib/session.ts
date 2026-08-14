// src/lib/session.ts
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'session';

const SESSION_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // 180 días

function firmar(valor: string): string {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new Error('Falta la variable de entorno AUTH_SECRET');
  return createHmac('sha256', secreto).update(valor).digest('hex');
}

/** Crea un token de sesión firmado, con la fecha de expiración incluida. */
export function crearSessionToken(): { token: string; maxAgeSegundos: number } {
  const expira = Date.now() + SESSION_DURATION_MS;
  const firma = firmar(String(expira));
  return { token: `${expira}.${firma}`, maxAgeSegundos: Math.floor(SESSION_DURATION_MS / 1000) };
}

/** Verifica que un token de sesión sea válido y no haya expirado. */
export function verificarSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiraStr, firma] = token.split('.');
  if (!expiraStr || !firma) return false;

  const expira = Number(expiraStr);
  if (!Number.isFinite(expira) || Date.now() > expira) return false;

  let esperada: string;
  try {
    esperada = firmar(expiraStr);
  } catch {
    return false;
  }

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Compara una contraseña recibida contra la real, en tiempo constante. */
export function contraseñaCorrecta(intento: string): boolean {
  const real = process.env.APP_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(intento);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
