'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type LedgerItem = {
  id?: string | number;
  ts?: string;
  type?: 'credit' | 'debit' | string;
  amount?: number;
  counterparty_email?: string | null;
};

export default function WalletChart() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session} } = await supabase.auth.getSession();
        const token = session?.access_token ?? '';
        const res = await fetch('/api/cashier/ledger', {
          headers: { authorization: `Bearer ${token}` }, // 🔑 HEADER CON TOKEN
          cache: 'no-store',
        });

        if (!res.ok) { if (alive) setItems([]); return; }
        const j = await res.json().catch(() => ({ items: [] }));
        if (alive) setItems(Array.isArray(j.items) ? j.items : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="card">Cargando movimientos…</div>;
  if (!items.length) return <div className="card">Sin movimientos aún.</div>;

  return (
    <div className="card">
      <div className="section-title">Últimos movimientos</div>
      <div style={{ marginTop: 8 }}>
        {items.map((it, i) => (
          <div key={it.id ?? i} style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr auto',
            padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,.06)'
          }}>
            <div style={{ opacity: .8 }}>
              {it.ts ? new Date(it.ts).toLocaleString('es-PY') : '—'}
            </div>
            <div>
              {it.type === 'credit' ? 'Ingreso' : it.type === 'debit' ? 'Egreso' : (it.type ?? '—')}
              {it.counterparty_email ? ` · ${it.counterparty_email}` : ''}
            </div>
            <div style={{ fontWeight: 800, color: it.type === 'credit' ? '#22c55e' : '#ef4444' }}>
              ₲ {new Intl.NumberFormat('es-PY').format(it.amount ?? 0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
