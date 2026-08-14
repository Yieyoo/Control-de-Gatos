// src/lib/cerrarSesion.ts
export async function cerrarSesion() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}
