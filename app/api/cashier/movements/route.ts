// app/api/cashier/movements/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    // --- Validar token como en tus otros endpoints ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // --- Parámetros (limit opcional) ---
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

    // --- Traer movimientos del cajero (admin bypass RLS) ---
    const { data: movs, error: movErr } = await supabaseAdmin
      .from('movements')
      .select('id, ts, cashier_id, from_user, to_user, amount, kind, note')
      .eq('cashier_id', user.id)
      .order('ts', { ascending: false })
      .limit(limit);

    if (movErr) throw movErr;

    // --- Mapear emails de from/to ---
    const ids = Array.from(new Set([
      ...(movs ?? []).map(m => m.from_user).filter(Boolean),
      ...(movs ?? []).map(m => m.to_user).filter(Boolean),
    ] as string[]));

    let emailById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', ids);
      if (profErr) throw profErr;
      emailById = Object.fromEntries((profs ?? []).map(p => [p.id, p.email || '']));
    }

    const rows = (movs ?? []).map(m => ({
      id: m.id,
      ts: m.ts,
      amount: m.amount,
      kind: m.kind as 'debit' | 'credit',
      from_email: m.from_user ? (emailById[m.from_user] || '') : '',
      to_email: m.to_user ? (emailById[m.to_user] || '') : '',
      note: m.note || '',
    }));

    return NextResponse.json({ movements: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
