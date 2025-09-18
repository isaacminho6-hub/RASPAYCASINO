'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import WalletChart from './WalletChart';

type Role = 'admin' | 'cashier' | 'user' | null;
type Move = {
  id: number;
  ts: string;
  amount: number;
  kind: 'debit' | 'credit';
  from_email: string;
  to_email: string;
  note: string;
};

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function CashierPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // wallet
  const [balance, setBalance] = useState<number>(0);
  const [initialCapital, setInitialCapital] = useState<number | null>(null); // null => no hay columna

  // UI acciones
  const [newUserEmail, setNewUserEmail] = useState('');
  const [creditEmail, setCreditEmail] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [busy, setBusy] = useState<'create' | 'credit' | 'baseline' | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // historial
  const [moves, setMoves] = useState<Move[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2200);
  };

  // ===== session + role + wallet =====
  const loadMe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setRedirecting(true); router.replace('/login'); return null; }
    setEmail(session.user.email ?? '');

    const { data: prof, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) { setErr(error.message); return null; }

    const r = (prof?.role ?? null) as Role;
    setRole(r);
    if (r !== 'cashier' && r !== 'admin') { setRedirecting(true); router.replace('/'); return null; }

    await loadWallet(session.user.id);
    await loadMoves(); // 👈 cargar historial al entrar
    return session.user.id;
  };

  const loadWallet = async (userId: string) => {
    // Intentar traer balance + initial_capital (si existe)
    const q = await supabase
      .from('wallets')
      .select('balance, initial_capital')
      .eq('user_id', userId)
      .maybeSingle();

    if (!q.error) {
      setBalance(q.data?.balance ?? 0);
      setInitialCapital(
        typeof q.data?.initial_capital === 'number'
          ? q.data.initial_capital
          : 0 // columna existe pero null → tratamos como 0
      );
      return;
    }

    // Fallback: solo balance (si no existe la columna initial_capital)
    const q2 = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    setBalance(q2.data?.balance ?? 0);
    setInitialCapital(null);
  };

  const loadMoves = async () => {
    try {
      setMovesLoading(true);
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/cashier/movements?limit=100', {
        headers: { authorization: `Bearer ${token}` }
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setMoves(Array.isArray(j.movements) ? j.movements : []);
      else showToast(j?.error || 'No se pudo cargar el historial', 'err');
    } finally {
      setMovesLoading(false);
    }
  };

  const refreshBalance = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await loadWallet(session.user.id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const me = await loadMe();
        if (!me) return;
      } catch (e: any) {
        setErr(e?.message ?? 'Error cargando');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) { setRedirecting(true); router.replace('/login'); }
    });
    return () => { sub.subscription?.unsubscribe(); cancelled = true; };
  }, [router]);

  // ===== acciones =====
  const createUser = async () => {
    const em = newUserEmail.trim().toLowerCase();
    if (!em || !em.includes('@')) return showToast('Email de jugador inválido', 'err');
    setBusy('create');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No autenticado');

      const res = await fetch('/api/cashier/create-user', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`, // 🔑 HEADER CON TOKEN
        },
        body: JSON.stringify({ email: em }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Error creando jugador');
      setNewUserEmail('');
      showToast('Jugador creado / invitado ✅', 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'Error', 'err');
    } finally {
      setBusy(null);
    }
  };

  const creditUser = async () => {
    const em = creditEmail.trim().toLowerCase();
    const amt = Math.floor(Number(String(creditAmount).replace(/[^\d]/g, ''))); // sanitiza
    if (!em || !em.includes('@')) return showToast('Email inválido', 'err');
    if (!Number.isFinite(amt) || amt <= 0) return showToast('Monto inválido', 'err');

    setBusy('credit');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No autenticado');

      const res = await fetch('/api/cashier/credit-user', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`, // 🔑 HEADER CON TOKEN
        },
        body: JSON.stringify({ targetEmail: em, amount: amt }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Error acreditando');
      setCreditEmail(''); setCreditAmount('');
      await refreshBalance();
      await loadMoves(); // 👈 refrescar historial después de acreditar
      showToast('Saldo acreditado ✅', 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'Error', 'err');
    } finally {
      setBusy(null);
    }
  };

  // Fijar capital inicial = saldo actual (si existe columna y RLS lo permite)
  const setBaseline = async () => {
    if (initialCapital === null) return; // no hay columna en la DB
    setBusy('baseline');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No autenticado');

      const { error } = await supabase
        .from('wallets')
        .update({ initial_capital: balance })
        .eq('user_id', session.user.id);

      if (error) throw error;
      setInitialCapital(balance);
      showToast('Capital inicial fijado ✅', 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo fijar el capital', 'err');
    } finally {
      setBusy(null);
    }
  };

  // ===== render =====
  if (redirecting) return null;
  if (loading) return <div className="container" style={{ padding: 24 }}>Cargando…</div>;
  if (err) return <div className="container" style={{ padding: 24, color: 'salmon' }}>Error: {err}</div>;

  const fmt = (n: number) => new Intl.NumberFormat('es-PY').format(n);

  const hasBaseline = typeof initialCapital === 'number';
  const pnlAbs = hasBaseline ? balance - (initialCapital ?? 0) : 0;
  const pnlPct = hasBaseline && (initialCapital ?? 0) > 0
    ? (pnlAbs / (initialCapital as number)) * 100
    : 0;
  const pnlColor = pnlAbs > 0 ? 'rgba(0, 200, 120, 0.95)'
    : pnlAbs < 0 ? 'rgba(255, 80, 80, 0.95)'
    : 'rgba(255, 255, 255, 0.85)';

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 24 }}>
      <div className="card-strong" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Panel de Cajero</div>
            <div className="small" style={{ marginTop: 6 }}>
              Bienvenido, <b>{email || '—'}</b>
              <span style={{ marginLeft: 8, opacity: .8 }}>· Rol: {role}</span>
            </div>
          </div>

          {/* Saldo grande */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, opacity: .7 }}>Saldo disponible</div>
            <div style={{
              fontSize: 46,
              fontWeight: 900,
              color: '#FFD54F',
              textShadow: '0 0 6px rgba(255,213,79,0.6), 0 0 18px rgba(246,204,59,0.25)'
            }}>
              ₲ {fmt(balance)}
            </div>

            {/* P&L si hay columna initial_capital */}
            {hasBaseline && (
              <div style={{
                marginTop: 6,
                fontWeight: 800,
                fontSize: 18,
                color: pnlColor,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 8
              }}>
                {pnlAbs >= 0 ? '▲' : '▼'} {pnlAbs >= 0 ? '+' : ''}₲ {fmt(pnlAbs)}
                <span style={{ opacity: .85 }}>
                  ({pnlAbs >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                </span>
              </div>
            )}

            {hasBaseline ? (
              <button
                className="btn btn-pill"
                style={{ marginTop: 10 }}
                onClick={setBaseline}
                disabled={busy === 'baseline'}
              >
                {busy === 'baseline' ? 'Guardando…' : 'Fijar capital inicial = saldo actual'}
              </button>
            ) : (
              <div className="small" style={{ marginTop: 10, opacity: .7 }}>
                Para mostrar Ganancia/Pérdida agregá la columna <code>initial_capital</code> a <code>wallets</code>.
              </div>
            )}
          </div>

          <Link href="/game" className="btn btn-pill" style={{ justifySelf: 'end' }}>
            ← Volver al juego
          </Link>
        </div>
      </div>

      {/* 📊 Gráfico / lista de movimientos */}
      <WalletChart />

      {/* 🧾 Historial */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><span>🧾</span> Historial</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-pill" onClick={loadMoves} disabled={movesLoading}>
            {movesLoading ? 'Cargando…' : '↻ Actualizar'}
          </button>
          <div style={{ flex: 1 }} />
          <div className="small" style={{ opacity: .8 }}>{moves.length} mov.</div>
        </div>

        <div className="table" style={{ marginTop: 12 }}>
          <div className="thead">
            <div>Detalle</div>
            <div style={{ textAlign: 'right' }}>Monto</div>
            <div style={{ textAlign: 'right' }}>Fecha</div>
          </div>

          {moves.length === 0 ? (
            <div className="row" style={{ padding: '14px 8px', opacity: .7 }}>Sin movimientos aún.</div>
          ) : moves.map(m => {
              const dir = m.kind === 'debit' ? '▼' : '▲';
              const color = m.kind === 'debit' ? 'salmon' : 'rgb(0, 200, 120)';
              const detalle = m.kind === 'debit'
                ? `Salida a ${m.to_email || '—'}`
                : `Acreditación a ${m.to_email || '—'}`;
              return (
                <div key={m.id} className="tr">
                  <div>{dir} <span style={{ color }}>{detalle}</span></div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>₲ {fmt(m.amount)}</div>
                  <div style={{ textAlign: 'right', opacity: .8 }}>
                    {new Date(m.ts).toLocaleString('es-PY')}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="admin-grid" style={{ marginTop: 12 }}>
        {/* Crear jugador */}
        <div className="card">
          <div className="section-title"><span>👤</span> Crear jugador</div>
          <div className="section-sub" style={{ marginTop: 6, marginBottom: 12 }}>
            Invita por email. El jugador definirá su contraseña con el enlace.
          </div>
          <div className="row">
            <input
              className="input"
              type="email"
              placeholder="jugador@email.com"
              value={newUserEmail}
              onChange={e => setNewUserEmail(e.target.value)}
              style={{ maxWidth: 420 }}
            />
            <button className="btn" onClick={createUser} disabled={busy === 'create'}>
              {busy === 'create' ? 'Creando…' : 'Crear jugador'}
            </button>
          </div>
        </div>

        {/* Acreditar saldo */}
        <div className="card">
          <div className="section-title"><span>🪙</span> Acreditar saldo a jugador</div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="email"
              placeholder="jugador@email.com"
              value={creditEmail}
              onChange={e => setCreditEmail(e.target.value)}
              style={{ maxWidth: 380 }}
            />
            <input
              className="input"
              placeholder="Monto (Gs.)"
              inputMode="numeric"
              value={creditAmount}
              onChange={e => setCreditAmount(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <button className="btn btn-gold" onClick={creditUser} disabled={busy === 'credit'}>
              {busy === 'credit' ? 'Acreditando…' : 'Acreditar'}
            </button>
          </div>
          <div className="small" style={{ marginTop: 8, opacity: .8 }}>
            Se descuenta de tu saldo y se transfiere al jugador.
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type === 'ok' ? 'toast-ok' : 'toast-err'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
