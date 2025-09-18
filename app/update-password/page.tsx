// app/update-password/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<string>('Verificando enlace...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase crea sesión temporal al entrar desde el link (invite/recovery)
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) {
        setMsg('Enlace inválido o expirado. Pedí uno nuevo al administrador.')
        setReady(false)
      } else {
        setMsg('Definí tu nueva contraseña')
        setReady(true)
      }
    })
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 6) return setMsg('La contraseña debe tener al menos 6 caracteres.')
    if (pw !== pw2) return setMsg('Las contraseñas no coinciden.')

    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setMsg(`Error: ${error.message}`)

    setMsg('✅ ¡Listo! Contraseña actualizada.')
    setTimeout(() => router.push('/login'), 1000) // redirige al login (mejor UX)
  }

  return (
    <div style={{ minHeight: '100vh', display:'grid', placeItems:'center', background:'#0E0A1B' }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 360,
          background:'#1b1532',
          padding: 24,
          borderRadius:16,
          border:'1px solid rgba(255,255,255,.08)'
        }}
      >
        <h2 style={{ color:'#F6CC3B', marginBottom: 12 }}>Crear / Actualizar contraseña</h2>
        <p style={{ color:'#cbd5e1', marginBottom: 16 }}>{msg}</p>

        {ready && (
          <>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={pw}
              onChange={e=>setPw(e.target.value)}
              style={{
                width:'100%',
                padding:12,
                borderRadius:8,
                marginBottom:8,
                border:'1px solid #2a2352',
                background:'#0f0a22',
                color:'#fff'
              }}
            />
            <input
              type="password"
              placeholder="Repetir contraseña"
              value={pw2}
              onChange={e=>setPw2(e.target.value)}
              style={{
                width:'100%',
                padding:12,
                borderRadius:8,
                marginBottom:12,
                border:'1px solid #2a2352',
                background:'#0f0a22',
                color:'#fff'
              }}
            />
            <button
              type="submit"
              style={{
                width:'100%',
                padding:12,
                borderRadius:999,
                fontWeight:800,
                background:'linear-gradient(180deg,#FFE69A,#F6CC3B)',
                color:'#2b1d00',
                border:'none'
              }}
            >
              Guardar contraseña
            </button>
          </>
        )}
      </form>
    </div>
  )
}
