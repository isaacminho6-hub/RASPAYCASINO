import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    // --- Validar token ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { targetEmail, amount } = await req.json();
    if (!targetEmail || !amount) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // --- Buscar al jugador ---
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', targetEmail)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
    }

    // --- Restar saldo al cajero ---
    const { data: cashierWallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletErr || !cashierWallet) {
      return NextResponse.json({ error: 'No se encontró wallet del cajero' }, { status: 400 });
    }

    if (cashierWallet.balance < amount) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 });
    }

    // --- Transacción: mover saldo ---
    await supabaseAdmin.from('wallets')
      .update({ balance: cashierWallet.balance - amount })
      .eq('user_id', user.id);

    await supabaseAdmin.from('wallets')
      .upsert({ user_id: targetUser.id, balance: amount }, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true, message: 'Saldo acreditado correctamente' });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
