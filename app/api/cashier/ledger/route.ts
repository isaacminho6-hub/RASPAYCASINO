// app/api/cashier/ledger/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Tomamos el token si viene, pero NO cortamos si falta
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    // Creamos el client con o sin header Authorization
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const options: any = token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {};

    const supa = createClient(url, anon, options);

    // Si no hay sesión válida -> devolvemos vacío (no rompe el gráfico)
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ items: [] });

    // Consultar movimientos; si no existe la tabla o falla, devolvemos []
    const { data, error } = await supabaseAdmin
      .from('ledger')
      .select('id, ts, type, amount, counterparty_email')
      .eq('user_id', user.id)
      .order('ts', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error ledger:', error.message);
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    console.error('Excepción ledger:', e);
    return NextResponse.json({ items: [] });
  }
}
