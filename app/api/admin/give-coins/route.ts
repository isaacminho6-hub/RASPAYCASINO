// app/api/admin/give-coins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { targetId, amount } = (await req.json()) as { targetId: string; amount: number };

    // validar payload
    const amt = Math.floor(Number(amount));
    if (!targetId || !Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // validar sesión (en server, con cookies)
    const ck = cookies();
    const supaServer = createServerClient(URL, ANON, {
      cookies: { get: (n: string) => ck.get(n)?.value, set() {}, remove() {} },
    });

    const { data: me } = await supaServer.auth.getUser();
    if (!me?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // sólo admin puede mintear
    const { data: callerProfile, error: roleErr } = await supaServer
      .from('profiles')
      .select('role')
      .eq('id', me.user.id)
      .maybeSingle();
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });
    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // verificar que el destino exista en profiles
    const { data: dest, error: destErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', targetId)
      .maybeSingle();
    if (destErr) return NextResponse.json({ error: destErr.message }, { status: 500 });
    if (!dest) return NextResponse.json({ error: 'Destino inexistente' }, { status: 404 });

    // asegurar que el destino tenga wallet sin sobreescribir saldo existente
    await supabaseAdmin.from('wallets').upsert(
      { user_id: targetId, balance: 0 },
      { onConflict: 'user_id', ignoreDuplicates: false }
    );

    // MINT auditado en ledger
    const { error: mintErr } = await supabaseAdmin.rpc('wallet_increment', {
      p_user_id: targetId,
      p_amount: amt,
      p_actor: me.user.id,
      p_note: 'Recarga por admin',
    });
    if (mintErr) return NextResponse.json({ error: mintErr.message }, { status: 500 });

    // obtener nuevo balance
    const { data: w, error: wErr } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', targetId)
      .maybeSingle();
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, balance: w?.balance ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
