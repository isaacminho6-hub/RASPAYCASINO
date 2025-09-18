// app/api/cashier/create-user/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: Request) {
  try {
    // ── Body ────────────────────────────────────────────────────────────────────
    const raw = (await req.json()) as { email?: string; targetEmail?: string }
    const email = String((raw?.email ?? raw?.targetEmail ?? '')).trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // ── Auth: token del cajero/admin ───────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Falta token' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')

    const supabaseServer = createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // usuario autenticado
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // rol del cajero
    const cashierId = userData.user.id
    const { data: prof } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', cashierId)
      .maybeSingle()

    if (!prof || (prof.role !== 'cashier' && prof.role !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ── Invitar usuario ────────────────────────────────────────────────────────
    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    if (inviteErr) {
      // Si ya existía en Auth, devolvemos un link de recuperación
      const { data: recovery } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      })
      return NextResponse.json({
        ok: true,
        invited: false,
        inviteLink: recovery?.action_link,
        message: 'Usuario ya existía, se generó link de recuperación.',
      })
    }

    // Rol por defecto en profiles
    await supabaseAdmin.from('profiles').upsert({
      id: invited.user.id,
      email,
      role: 'user',
    })

    // Wallet base
    await supabaseAdmin
      .from('wallets')
      .upsert({ user_id: invited.user.id, balance: 0 }, { onConflict: 'user_id' })

    return NextResponse.json({
      ok: true,
      invited: true,
      inviteLink: invited.invite?.action_link,
      message: 'Se envió invitación al jugador para crear su contraseña.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
