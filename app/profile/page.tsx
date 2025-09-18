'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'admin' | 'cashier' | 'user' | null;

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      const mail = session?.user?.email ?? null;
      setEmail(mail);

      if (!uid) { setRole(null); setLoading(false); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)         // <- SIEMPRE por id
        .single();             // <- obliga a traer una sola fila

      if (error) {
        console.error('profiles/select error:', error);
        setRole(null);
      } else {
        setRole((data?.role as Role) ?? 'user');
      }
      setLoading(false);
    })();
  }, []);

  const textoRol = role === 'admin' ? 'admin' : role === 'cashier' ? 'cajero' :
                   role === 'user' ? 'usuario' : 'desconocido';

  return (
    <main style={{ padding: 24 }}>
      <h1>Mi perfil</h1>
      <p>Email: {email ?? '—'}</p>
      <p>Rol: {loading ? 'cargando…' : textoRol}</p>
      <a href="/game">↩ Volver al juego</a>
    </main>
  );
}
