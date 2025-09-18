// app/api/admin/create-user/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, role, coins = 0 } = body as {
      email: string; password: string; role: 'cashier' | 'user'; coins?: number;
    };

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    // Verificar que el caller esté logueado y su rol
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const callerId = session.user.id;
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 401 });

    // Reglas:
    // - admin puede crear cashier y user
    // - cashier solo puede crear user
    if (callerProfile.role !== 'admin' && !(callerProfile.role === 'cashier' && role === 'user')) {
      return NextResponse.json({ error: 'Permiso denegado' }, { status: 403 });
    }

    // Crear usuario en Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message || 'Error al crear usuario' }, { status: 500 });
    }

    const newId = created.user.id;

    // Upsert en profiles
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: newId, email, role, coins: coins ?? 0 }, { onConflict: 'id' });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
