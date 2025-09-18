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

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Falta email' }, { status: 400 });
    }

    // --- Crear jugador con Supabase Admin ---
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      if (inviteError.message.includes('already registered')) {
        return NextResponse.json({ ok: true, message: 'Usuario ya existe, se generó link de recuperación.' });
      }
      throw inviteError;
    }

    // --- Crear wallet si no existe ---
    await supabaseAdmin.from('wallets')
      .upsert({ user_id: invited.user?.id, balance: 0 }, { onConflict: 'user_id' });

    return NextResponse.json({
      ok: true,
      message: 'Se envió invitación al jugador para crear su contraseña.',
      invited: invited.user,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
