'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type CashierRow = {
  id: string;
  email: string | null;
  role: 'cashier';
  balance: number;
};

export default function AdminPage() {
  const [meEmail, setMeEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [cashiers, setCashiers] = useState<CashierRow[]>([]);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [oneCashierId, setOneCashierId] = useState<string>('');
  const [oneAmount, setOneAmount] = useState<string>('');
  const [splitTotal, setSplitTotal] = useState<string>('');
  const [busyAction, setBusyAction] = useState<'promote'|'addOne'|'splitAll'|null>(null);
  const [toast, setToast] = useState<{type:'ok'|'err', msg:string}|null>(null);

  const reloadCashiers = async () => {
    // Traer cajeros
    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('id,email,role')
      .eq('role', 'cashier')
      .order('email', { ascending: true });

    if (profErr) throw profErr;

    // Traer wallets
    const { data: wallets, error: wErr } = await supabase
      .from('wallets')
      .select('user_id,balance');

    if (wErr) throw wErr;

    // Mapear cajeros con su balance
    const rows: CashierRow[] = (profs ?? []).map((p: any) => {
      const w = wallets?.find(w => w.user_id === p.id);
      return {
        id: p.id,
        email: p.email,
        role: 'cashier',
        balance: w?.balance ?? 0,
      };
    });

    setCashiers(rows);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setErr(null);
        const { data: sessionData } = await supabase.auth.getSession();
        setMeEmail(sessionData?.session?.user?.email ?? '');
        await reloadCashiers();
      } catch (e: any) {
        setErr(e.message ?? 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2200);
  };

  // --- acciones ---

  const promoteToCashier = async () => {
    const email = promoteEmail.trim();
    if (!email || !email.includes('@')) return showToast('Ingresá un email válido', 'err');

    setBusyAction('promote');
    try {
      const res = await fetch('/api/admin/create-cashier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Error creando cajero');

      await reloadCashiers();
      setPromoteEmail('');
      showToast('Cajero creado/ascendido ✅', 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'Error ascendiendo', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const addCoinsToOne = async () => {
    const id = oneCashierId;
    const amt = Math.floor(Number(oneAmount));
    if (!id) return showToast('Elegí un cajero', 'err');
    if (!Number.isFinite(amt) || amt <= 0) return showToast('Monto inválido', 'err');

    setBusyAction('addOne');
    try {
      const res = await fetch('/api/admin/give-coins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetId: id, amount: amt }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Error agregando monedas');

      await reloadCashiers();
      setOneAmount('');
      showToast('Monedas agregadas ✅', 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'Error agregando monedas', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const splitToAll = async () => {
    const total = Math.floor(Number(splitTotal));
    const n = cashiers.length;
    if (n === 0) return showToast('No hay cajeros', 'err');
    if (!Number.isFinite(total) || total <= 0) return showToast('Monto total inválido', 'err');

    const each = Math.floor(total / n);
    if (each <= 0) return showToast(`El total es muy chico para ${n} cajeros`, 'err');

    setBusyAction('splitAll');
    try {
      for (const c of cashiers) {
        const res = await fetch('/api/admin/give-coins', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetId: c.id, amount: each }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || 'Error al repartir');
        }
      }

      await reloadCashiers();
      setSplitTotal('');
      showToast(`Repartido ${each.toLocaleString()} a cada cajero ✅`, 'ok');
    } catch (e: any) {
      showToast(e.message ?? 'Error al repartir', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const cashiersCount = cashiers.length;
  const headerSubtitle = useMemo(() => {
    if (loading) return 'Cargando…';
    if (err) return 'Error de carga';
    return `${cashiersCount} cajero${cashiersCount === 1 ? '' : 's'} activos`;
  }, [loading, err, cashiersCount]);

  return (
    <div>
      <div className="container" style={{paddingTop: 20, paddingBottom: 24}}>
        {/* Encabezado */}
        <div className="card-strong" style={{marginBottom: 16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:28,fontWeight:900,letterSpacing:.2}}>Panel de Admin</div>
              <div className="small" style={{marginTop:6}}>
                Bienvenido, <b>{meEmail || '—'}</b>
                <span style={{marginLeft:8,opacity:.8}}>· {headerSubtitle}</span>
              </div>
            </div>
            <Link href="/game" className="btn btn-pill">← Volver al juego</Link>
          </div>
        </div>

        {/* Acciones */}
        <div className="admin-grid">
          {/* Crear / Ascender */}
          <div className="card" style={{borderColor:'#4C3AA5'}}>
            <div className="section-title"><span>✨</span> Crear / ascender cajero</div>
            <div className="section-sub" style={{marginTop:6,marginBottom:12}}>
              Convertí un email en cajero. No necesita haber iniciado sesión.
            </div>

            <div className="row" style={{marginTop:8}}>
              <input
                className="input" type="email" placeholder="email@dominio.com"
                value={promoteEmail} onChange={e=>setPromoteEmail(e.target.value)}
                style={{maxWidth:420}}
              />
              <button className="btn" onClick={promoteToCashier} disabled={busyAction==='promote'}>
                {busyAction==='promote' ? 'Creando…' : 'Ascender / crear cajero'}
              </button>
            </div>
          </div>

          {/* Repartir monedas */}
          <div className="card" style={{borderColor:'rgba(246,204,59,.35)'}}>
            <div className="section-title"><span>🪙</span> Repartir monedas a cajeros</div>

            {/* A uno */}
            <div style={{marginTop:14, marginBottom:8, fontWeight:800}}>A un cajero</div>
            <div className="row">
              <select
                className="input" value={oneCashierId} onChange={e=>setOneCashierId(e.target.value)}
                style={{maxWidth:420}}
              >
                <option value="">Seleccioná cajero…</option>
                {cashiers.map(c=>(
                  <option key={c.id} value={c.id}>
                    {c.email} — {Intl.NumberFormat('es-PY').format(c.balance)} 🪙
                  </option>
                ))}
              </select>
              <input
                className="input" placeholder="Monto" inputMode="numeric"
                value={oneAmount} onChange={e=>setOneAmount(e.target.value)}
                style={{maxWidth:140}}
              />
              <button className="btn btn-warn" onClick={addCoinsToOne} disabled={busyAction==='addOne'}>
                {busyAction==='addOne' ? 'Agregando…' : 'Agregar monedas'}
              </button>
            </div>

            {/* A todos */}
            <div style={{marginTop:18, marginBottom:8, fontWeight:800}}>A todos por igual</div>
            <div className="row">
              <input
                className="input" placeholder="Monto total a repartir" inputMode="numeric"
                value={splitTotal} onChange={e=>setSplitTotal(e.target.value)}
                style={{maxWidth:240}}
              />
              <button className="btn btn-ok" onClick={splitToAll} disabled={busyAction==='splitAll'}>
                {busyAction==='splitAll'
                  ? `Repartiendo a ${cashiersCount}…`
                  : `Repartir a ${cashiersCount} cajero${cashiersCount===1?'':'s'}`}
              </button>
              <span className="badge badge-amber">
                Consejo: se divide en partes iguales
              </span>
            </div>
          </div>
        </div>

        {/* Listado */}
        <div className="card" style={{marginTop:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div className="section-title" style={{fontSize:18}}>Cajeros</div>
            <span className="badge badge-violet">{cashiersCount} activo{cashiersCount===1?'':'s'}</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Monedas</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.length===0 && (
                  <tr><td colSpan={3} style={{opacity:.7,padding:'14px 6px'}}>No hay cajeros aún.</td></tr>
                )}
                {cashiers.map(c=>(
                  <tr key={c.id}>
                    <td>{c.email}</td>
                    <td>{Intl.NumberFormat('es-PY').format(c.balance)} 🪙</td>
                    <td style={{textTransform:'uppercase',opacity:.85}}>{c.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`toast ${toast.type==='ok' ? 'toast-ok' : 'toast-err'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
