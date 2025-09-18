// app/api/admin/create-cashier/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { User } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Tipos flexibles para action_link (según plan/SDK puede venir en raíz o en properties)
type LinkWithRoot = { action_link?: string }
type LinkWithProps = { properties?: { action_link?: string } }

// Obtiene action_link desde distintas formas sin romper TS
function pickActionLink(data: unknown): string | null {
  const root = data as LinkWithRoot
  const props = data as LinkWithProps
  return root?.action_link ?? props?.properties?.action_link ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; coins?: number | string }
    const email = (body?.email || '').trim()
    // Soporte a coins string/number y aseguramos entero >= 0
    const coinsNum = Math.max(0, Math.floor(Number(body?.coins ?? 0)))

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // 1) validar sesión y rol admin
    const ck = cookies()
    const supabaseServer = createServerClient(URL, ANON, {
      cookies: {
        get: (name: string) => ck.get(name)?.value,
        set() {},
        remove() {},
      },
    })

    const { data: userData } = await supabaseServer.auth.getUser()
    if (!userData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // 2) buscar usuario por email (pagina 1; tipado explícito evita `never[]`)
    const { data: listPage1, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listErr) throw listErr

    const users: User[] = listPage1?.users ?? []
    const existing = users.find((u) => (u?.email ?? '').toLowerCase() === email.toLowerCase())

    let authUserId: string | null = null
    let inviteLink: string | null = null
    let recoveryLink: string | null = null
    let invited = false

    if (!existing) {
      // 3A) no existe -> enviar invitación (set password por email)
      const { data: invitedData, error: invErr } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${SITE}/update-password`,
          data: { role: 'cashier' },
        })
      if (invErr) {
        return NextResponse.json({ error: invErr.message }, { status: 500 })
      }
      invited = true
      authUserId = invitedData.user?.id ?? null
      // algunos planes devuelven el action_link en raíz; otros en properties
      inviteLink = pickActionLink(invitedData) // <- a prueba de SDK/plan
    } else {
      // 3B) ya existe -> generar link de recuperación
      authUserId = existing.id
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${SITE}/update-password` },
      })
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
      }
      recoveryLink = pickActionLink(linkData) // <- lectura segura
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'No se pudo obtener el usuario' }, { status: 500 })
    }

    // 4) upsert en profiles con rol cashier + asegurar wallet
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: authUserId, email, role: 'cashier' }, { onConflict: 'id' })
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // Si tu tabla wallets tiene unique(user_id), el upsert simple funciona;
    // si querés ser ultra explícito: .upsert({ ... }, { onConflict: 'user_id' })
    await supabaseAdmin.from('wallets').upsert({ user_id: authUserId, balance: 0 })

    // 5) si coins > 0 -> mint inicial auditable
    if (coinsNum > 0) {
      await supabaseAdmin.rpc('wallet_increment', {
        p_user_id: authUserId,
        p_amount: coinsNum,
        p_actor: userData.user.id,
        p_note: 'Alta/ascenso de cajero',
      })
    }

    return NextResponse.json({
      ok: true,
      invited,
      inviteLink,
      recoveryLink,
      next_steps: invited
        ? 'Se envió invitación por email. El cajero abrirá el link y definirá su contraseña.'
        : 'Se generó link de recuperación para que el cajero establezca nueva contraseña.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
