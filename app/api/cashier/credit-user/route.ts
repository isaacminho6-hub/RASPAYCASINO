// app/api/cashier/credit-user/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Normaliza montos como “50.000”, “50,000”, 50000 → 50000
function parseAmount(input: number | string): number {
  const n = Number(String(input ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

// 🚫 NO pisar balances existentes
async function ensureWallet(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const { error: insErr } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: userId, balance: 0 });
    if (insErr) throw insErr;
  }
}

export async function POST(req: Request) {
  try {
    // ── Body ────────────────────────────────────────────────────────────────────
    const raw = (await req.json()) as {
      targetEmail?: string;
      email?: string;
      amount?: number | string;
    };

    // alias/back-compat: aceptamos targetEmail o email
    const targetEmail = String((raw?.targetEmail ?? raw?.email ?? '')).trim().toLowerCase();
    const amt = parseAmount(raw?.amount ?? '');

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ error: 'Email destino inválido' }, { status: 400 });
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }

    // ── Auth: token del cajero/admin ───────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Falta token' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseServer = createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabaseServer.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ── Verificar rol de quien acredita ───────────────────────────────────────
    const cashierId = userData.user.id;
    const { data: prof, error: roleErr } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', cashierId)
      .maybeSingle();
    if (roleErr) throw roleErr;

    if (!prof || (prof.role !== 'cashier' && prof.role !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // ── Buscar jugador destino ─────────────────────────────────────────────────
    const { data: dest, error: destErr } = await supabaseAdmin
      .from('profiles')
      .select('id,role,email')
      .eq('email', targetEmail)
      .maybeSingle();
    if (destErr) throw destErr;

    if (!dest) {
      return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
    }
    if (dest.role !== 'user') {
      return NextResponse.json({ error: 'Solo se puede cargar saldo a usuarios' }, { status: 403 });
    }

    // ── Asegurar wallets (sin pisar saldos) ────────────────────────────────────
    await ensureWallet(cashierId);
    await ensureWallet(dest.id);

    // ── Verificar saldo del cajero ─────────────────────────────────────────────
    const { data: wCashier, error: wErr } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', cashierId)
      .maybeSingle();
    if (wErr) throw wErr;

    const current = wCashier?.balance ?? 0;
    if (current < amt) {
      return NextResponse.json({ error: 'Saldo de cajero insuficiente' }, { status: 400 });
    }

    // ── Transferencia (RPC) ────────────────────────────────────────────────────
    const { error: rpcErr } = await supabaseAdmin.rpc('wallet_transfer', {
      p_from: cashierId,
      p_to: dest.id,
      p_amount: amt,
      p_actor: cashierId,
      p_note: 'Carga por cajero',
    });
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    // ── Nuevo saldo del cajero ─────────────────────────────────────────────────
    const { data: wCashier2, error: w2Err } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', cashierId)
      .maybeSingle();
    if (w2Err) throw w2Err;

    return NextResponse.json({ ok: true, cashier_balance: wCashier2?.balance ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
