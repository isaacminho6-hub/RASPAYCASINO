// app/api/cashier/create-user/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Algunas versiones/planes devuelven el link en root.action_link y otras en properties.action_link
type LinkWithRoot  = { action_link?: string }
type LinkWithProps = { properties?: { action_link?: string } }
function pickActionLink(data: unknown): string | null {
  const root  = data as LinkWithRoot
  const props = data as LinkWithProps
  return root?.action_link ?? props?.properties?.action_link ?? null
}

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

    // rol del cajero/admin
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
    const { data: invitedData, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${SITE}/update-password`,
        data: { role: 'user' },
      })

    if (inviteErr) {
      // Si ya existía en Auth, devolvemos un link de recuperación
      const { data: recoveryData, error: linkErr } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${SITE}/update-password` },
        })
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
      }
      const recoveryLink = pickActionLink(recoveryData)
      return NextResponse.json({
        ok: true,
        invited: false,
        inviteLink: recoveryLink,
        message: 'Usuario ya existía, se generó link de recuperación.',
      })
    }

    const newUserId = invitedData?.user?.id ?? null
    if (!newUserId) {
      return NextResponse.json({ error: 'No se pudo crear/obtener el usuario' }, { status: 500 })
    }

    // Rol por defecto en profiles
    const { error: upErr } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newUserId,
        email,
        role: 'user',
      },
      { onConflict: 'id' }
    )
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Wallet base (si tienes unique en user_id, el onConflict evita duplicados)
    await supabaseAdmin
      .from('wallets')
      .upsert({ user_id: newUserId, balance: 0 }, { onConflict: 'user_id' })

    const inviteLink = pickActionLink(invitedData)

    return NextResponse.json({
      ok: true,
      invited: true,
      inviteLink,
      message: 'Se envió invitación al jugador para crear su contraseña.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
