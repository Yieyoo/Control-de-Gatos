// src/app/login/page.tsx
'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!resp.ok) {
        const datos = await resp.json().catch(() => ({}));
        throw new Error(datos.error || 'Contraseña incorrecta');
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setCargando(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
      >
        <div className="text-center mb-2">
          <p className="text-3xl mb-2">💵</p>
          <h1 className="text-xl font-bold text-gray-900">Control de Gastos</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresa tu contraseña para continuar</p>
        </div>

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-center tracking-widest"
        />

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
