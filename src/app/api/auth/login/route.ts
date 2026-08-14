// src/app/api/auth/login/route.ts
import { contraseñaCorrecta, crearSessionToken, SESSION_COOKIE } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (typeof password !== 'string' || !contraseñaCorrecta(password)) {
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
