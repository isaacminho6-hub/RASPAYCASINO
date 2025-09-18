'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const signIn = async () => {
    setErr('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { setErr(error.message); return }
      router.replace('/')
    } catch (e: any) {
      setErr(e?.message || 'Ocurrió un error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const enter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!loading) signIn()
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Iniciar sesión</h1>
        <form onSubmit={enter}>
          <label className="auth-label">Email</label>
          <input
            className="auth-input"
            type="email"
            placeholder="tu@email.com"
            value={email}
            autoComplete="email"
            onChange={e=>setEmail(e.target.value)}
          />
          <label className="auth-label">Contraseña</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            autoComplete="current-password"
            onChange={e=>setPassword(e.target.value)}
          />
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          {err && <div className="auth-error">⚠️ {err}</div>}
        </form>
      </div>

      {/* Estilos: paleta Fortuna (morado + dorado) y layout fijo */}
      <style jsx global>{`
        :root{
          --gold:#F6CC3B; --gold-deep:#8F6A17;
          --bg-1:#0E0A1B; --bg-2:#140E24; --violet-2:#22173D; --violet-4:#171235;
        }
        .auth-screen{
          min-height:100vh;
          display:flex; align-items:center; justify-content:center;
          padding:24px;
          background: radial-gradient(120% 120% at 10% -10%, rgba(246,204,59,.06), transparent 50%), var(--bg-1);
        }
        .auth-card{
          width:100%;
          max-width:420px; /* <- evita que se estire en PC */
          background: linear-gradient(180deg, var(--violet-2) 0%, var(--violet-4) 100%);
          border:1px solid rgba(255,255,255,.08);
          border-radius:20px;
          padding:24px;
          box-shadow: 0 10px 30px rgba(0,0,0,.35);
        }
        .auth-title{
          margin:0 0 14px 0; font-size:26px; font-weight:900;
          background: linear-gradient(90deg, #fff, var(--gold));
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .auth-label{
          display:block; margin:12px 4px 6px; font-size:12px; letter-spacing:.06em; opacity:.8;
        }
        .auth-input{
          width:100%;
          height:44px;
          border-radius:12px;
          padding:0 12px;
          border:1px solid rgba(255,255,255,.12);
          background: #16112F;
          color:#fff;
          outline:none;
        }
        .auth-input:focus{
          border-color: rgba(246,204,59,.45);
          box-shadow: 0 0 0 3px rgba(246,204,59,.18);
        }
        .auth-btn{
          margin-top:16px; width:100%; height:44px;
          border-radius:12px; font-weight:800;
          color:#2b1d00; background: linear-gradient(180deg,#FFE69A,#F6CC3B);
          border:1px solid rgba(246,204,59,.45);
          box-shadow: 0 6px 20px rgba(246,204,59,.25);
        }
        .auth-btn:disabled{ opacity:.7; cursor:not-allowed; }
        .auth-btn:hover:not(:disabled){ filter: brightness(1.03); }
        .auth-error{
          margin-top:10px; font-size:13px; color:#fda4af;
        }
      `}</style>
    </div>
  )
}
