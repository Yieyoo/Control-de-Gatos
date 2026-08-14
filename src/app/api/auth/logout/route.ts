// src/app/api/auth/logout/route.ts
import { SESSION_COOKIE } from '@/lib/session';

export async function POST() {
  const respuesta = Response.json({ success: true });
  respuesta.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
  return respuesta;
}
