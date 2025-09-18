import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, amount } = body;
    if (!user_id || !Number.isFinite(amount)) return NextResponse.json({ error: 'user_id y amount requeridos' }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const admin = createClient(url, serviceKey);

    const { error } = await admin.rpc('mint_to_wallet', { p_user_id: user_id, p_amount: amount });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}
