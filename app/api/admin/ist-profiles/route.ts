// app/api/admin/list-profiles/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const role = url.searchParams.get('role'); // 'admin' | 'cashier' | 'user' | null

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: caller } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!caller) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 401 });

    // admin lista todo, cashier solo users
    let q = supabaseAdmin.from('profiles').select('id, email, role, coins').order('email');
    if (caller.role === 'cashier') q = q.eq('role', 'user');
    if (caller.role === 'admin' && role) q = q.eq('role', role);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
