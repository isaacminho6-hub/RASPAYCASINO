'use client';
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

/* ===================== Types ===================== */
type Prize = { label: string; payout: number; weight: number };
type Winner = { name: string; amount: number; ts: number; city?: string };
type Role = 'admin' | 'cashier' | 'user' | null;

/* ===================== Config visual ===================== */
const TICKET_PRICE = 5000;
const JACKPOT_BASE = 2_000_000;
const SCRATCH_RADIUS = 28;
const PRIZE_CANVAS_HEIGHT = 300;
const PRIZE_FONT_FAMILY = '"Montserrat", ui-sans-serif';
const USE_PRIZE_IMAGES = true;

/* ====== PRIZES y edge (mismo esquema para DEMO y REAL) ====== */
const LOCAL_PRIZES: Prize[] = [
  { label: '🎟 ₲1.000',  payout: 1000,  weight: 260 },
  { label: '🎟 ₲3.000',  payout: 3000,  weight: 140 },
  { label: '🎟 ₲5.000',  payout: 5000,  weight:  95 },
  { label: '🎉 ₲15.000', payout: 15000, weight:  20 },
  { label: '💠 ₲25.000', payout: 25000, weight:   8 },
  { label: '💎 ₲50.000', payout: 50000, weight:   3 },
  { label: '👑 ₲100.000',payout:100000, weight:   1 },
];
// MISMO edge para ambos modos:
const HOUSE_EDGE = 0.12;

/* ===================== Audio ===================== */
function useLoopSound(url: string, volume = 0.22) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio(url);
    a.loop = true; a.preload = 'auto'; a.volume = volume;
    ref.current = a;
    return () => { try { a.pause(); } catch {}; ref.current = null; };
  }, [url, volume]);
  const play = () => { try { ref.current?.play()?.catch(() => {}); } catch {} };
  const stop = () => { const a = ref.current; if (!a) return; try { a.pause(); a.currentTime = 0; } catch {} };
  return { play, stop };
}
function useOneShotSound(url: string, volume = 0.9) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio(url);
    a.loop = false; a.preload = 'auto'; a.volume = volume;
    ref.current = a;
    return () => { try { a.pause(); } catch {}; ref.current = null; };
  }, [url, volume]);
  const play = () => { const a = ref.current; if (!a) return; try { a.currentTime = 0; a.play()?.catch(() => {}); } catch {} };
  const stop = () => { const a = ref.current; if (!a) return; try { a.pause(); a.currentTime = 0; } catch {} };
  return { play, stop };
}
function useBgm(url: string, initialVolume = 0.22) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const a = new Audio(url);
    a.loop = true; a.preload = 'auto'; a.volume = initialVolume;
    ref.current = a;
    return () => { a.pause(); ref.current = null; };
  }, [url, initialVolume]);
  const play = () => { try { ref.current?.play()?.then(() => setEnabled(true)).catch(() => {}); } catch {} };
  const pause = () => { try { ref.current?.pause(); setEnabled(false); } catch {} };
  const toggle = () => (enabled ? pause() : play());
  return { play, pause, toggle, enabled };
}

/* ===================== Utils ===================== */
function installGlobalAudioUnlock(startFns: Array<() => void>) {
  const tryResume = () => {
    startFns.forEach(fn => { try { fn(); } catch {} });
    window.removeEventListener('pointerdown', tryResume);
    window.removeEventListener('touchstart', tryResume);
    window.removeEventListener('keydown', tryResume);
    window.removeEventListener('click', tryResume);
  };
  window.addEventListener('pointerdown', tryResume, { once: true, passive: true });
  window.addEventListener('touchstart', tryResume, { once: true, passive: true });
  window.addEventListener('keydown', tryResume, { once: true });
  window.addEventListener('click', tryResume, { once: true });
}
const formatGs = (n: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n);

function keyFromLabel(label: string) {
  if (label.includes('₲100.000')) return '100k';
  if (label.includes('₲50.000'))  return '50k';
  if (label.includes('₲25.000'))  return '25k';
  if (label.includes('₲15.000'))  return '15k';
  if (label.includes('₲5.000'))   return '5k';
  if (label.includes('₲3.000'))   return '3k';
  if (label.includes('₲1.000'))   return '1k';
  if (label.includes('₲0') || /SIN PREMIO/i.test(label)) return '0';
  return '__TEXT_ONLY__';
}
function cleanPrizeText(label: string) {
  if (label.includes('₲0')) return '¡SIN PREMIO!';
  return label.replace('🎟 ','').replace('🎉 ','').replace('💠 ','').replace('💎 ','').replace('👑 ','');
}

/* ===================== Confetti ===================== */
function boomConfetti(node: HTMLElement | null, opts: { gold?: boolean; power?: number } = {}) {
  if (!node) return;
  const { gold = true, power = 1 } = opts;
  const c = document.createElement('canvas');
  c.width = node.clientWidth; c.height = node.clientHeight;
  c.style.position = 'absolute'; c.style.inset = '0'; c.style.pointerEvents = 'none';
  node.appendChild(c);

  const ctx = c.getContext('2d')!;
  const N = Math.round(140 * power);
  const palette = gold
    ? ['#F7D774','#F2C94C','#FFD166','#E9B949','#FFB703']
    : ['#a855f7','#60a5fa','#22c55e','#f59e0b'];

  const parts = Array.from({ length: N }).map(() => {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const r = (2 + Math.random() * 3) * (gold ? 1.4 * power : 1 * power);
    const vx = (-1 + Math.random() * 2) * (gold ? 1.2 : 1);
    const vy = (2 + Math.random() * 3) * (gold ? 1.2 * power : 1 * power);
    const shape = Math.random() < 0.2 ? 'star' : (Math.random() < 0.5 ? 'rect' : 'circle');
    return { x: Math.random() * c.width, y: -20 - Math.random() * 80, vx, vy, r, a: 1,
      spin: (Math.random() - 0.5) * 0.25, rot: Math.random() * Math.PI, color, shape };
  });

  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.a *= 0.992; p.rot += p.spin;
      ctx.globalAlpha = p.a;
      ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.fillStyle = p.color;

      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 'rect') { ctx.fillRect(-p.r * 1.1, -p.r * 0.6, p.r * 2.2, p.r * 1.2); }
      else if (p.shape === 'star') {
        const spikes = 5, outer = p.r * 1.8, inner = p.r * 0.7;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const rad = (i * Math.PI) / spikes;
          const rr = i % 2 === 0 ? outer : inner;
          ctx.lineTo(Math.cos(rad) * rr, Math.sin(rad) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(0, 0, p.r * 1.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (parts.some(p => p.a > 0.05 && p.y < c.height + 20)) requestAnimationFrame(tick);
    else node.removeChild(c);
  })();
}

/* ===================== Prize images ===================== */
const IMG_CACHE: Record<string, HTMLImageElement> = {};
function loadPrizeImage(key: string) {
  if (key === '__TEXT_ONLY__') return Promise.reject('text-only');
  if (IMG_CACHE[key]) return Promise.resolve(IMG_CACHE[key]);
  const sources = [`/prizes/${key}.svg`, `/prizes/${key}.png`];
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    let i = 0;
    const tryLoad = () => {
      if (i >= sources.length) { reject(new Error('not-found')); return; }
      img.src = sources[i++];
    };
    img.onload = () => { IMG_CACHE[key] = img; resolve(img); };
    img.onerror = () => { tryLoad(); };
    tryLoad();
  });
}

/* ===================== Component ===================== */
function Game() {
  const router = useRouter();

  /* ===== Sesión & rol ===== */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user?.id) {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setRole(!error && data?.role ? (data.role as Role) : 'user');
      } else setRole(null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user?.id) {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setRole(!error && data?.role ? (data.role as Role) : 'user');
      } else { setRole(null); }
    });
    return () => { sub.subscription?.unsubscribe(); };
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); setUserEmail(null); setUserId(null); setRole(null); };
  const goToPanel = () => {
    if (!role) return;
    if (role === 'admin') return router.push('/admin');
    if (role === 'cashier') return router.push('/cashier');
    return router.push('/profile');
  };

  /* ===== DEMO vs REAL ===== */
  const [realBalance, setRealBalance] = useState<number>(0);
  const [demoBalance, setDemoBalance] = useState<number>(25_000);
  const [useDemo, setUseDemo] = useState<boolean>(true);
  const isStaff = role === 'admin' || role === 'cashier';

  // Cargar saldo real + realtime
  const loadRealBalance = async (uid: string) => {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', uid)
      .maybeSingle();
    if (!error) setRealBalance(data?.balance ?? 0);
  };

  useEffect(() => {
    if (!userId) return;
    loadRealBalance(userId);
    const channel = supabase
      .channel(`wallets_balance_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const b = (payload.new && typeof payload.new.balance === 'number')
            ? payload.new.balance
            : (payload.old?.balance ?? realBalance);
          setRealBalance(b ?? 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Permitir REAL si está logueado y tiene al menos el precio del ticket
  const allowReal = !!userId && realBalance >= TICKET_PRICE;

  // Si no puede REAL, forzamos DEMO
  useEffect(() => {
    if (!allowReal) setUseDemo(true);
  }, [allowReal]);

  /* ===== Jackpot ===== */
  const [jackpot, setJackpot] = useState<number>(JACKPOT_BASE);
  useEffect(() => {
    (async () => {
      try {
        const q1 = await supabase.from('settings' as any).select('jackpot').limit(1).maybeSingle();
        if (q1?.data?.jackpot && typeof q1.data.jackpot === 'number') { setJackpot(q1.data.jackpot); return; }
        const q2 = await supabase.from('settings' as any).select('v').eq('k','jackpot').maybeSingle();
        if (q2?.data?.v?.jackpot && typeof q2.data.v.jackpot === 'number') setJackpot(q2.data.v.jackpot);
      } catch {}
    })();
  }, []);

  /* ===== Marketing: bonus countdown (10 min) ===== */
  const [bonusPct] = useState<number>(() => Math.floor(Math.random() * 7) + 2);
  const [bonusEndsAt] = useState<number>(() => Date.now() + 10 * 60 * 1000);
  const [bonusLeft, setBonusLeft] = useState<string>('10:00');
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, bonusEndsAt - Date.now());
      const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000);
      setBonusLeft(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, [bonusEndsAt]);

  /* ===== Tutorial ===== */
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  useEffect(() => {
    const seen = localStorage.getItem('rp_tutorial_seen') === '1';
    if (!seen) setShowTutorial(true);
  }, []);
  const closeTutorial = () => { setShowTutorial(false); localStorage.setItem('rp_tutorial_seen', '1'); };

  /* ===== Juego ===== */
  const [currentPrize, setCurrentPrize] = useState<Prize | null>(null);
  const [scratchedPct, setScratchedPct] = useState<number>(0);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(false);

  const [winners, setWinners] = useState<Winner[]>([
    { name: 'María A.', amount: 50000, ts: Date.now() - 1000 * 60 * 8,  city: 'San Lorenzo' },
    { name: 'Juan G.',  amount: 15000, ts: Date.now() - 1000 * 60 * 16, city: 'Encarnación' },
    { name: 'Sol R.',   amount: 3000,  ts: Date.now() - 1000 * 60 * 22, city: 'CDE' },
  ]);
  useEffect(() => {
    const cities = ['Asunción','Lambaré','Luque','Capiatá','San L.','CDE','Encarnación'];
    const id = setInterval(() => {
      setWinners(w => {
        const nw: Winner = {
          name: ['Ana','Luis','Camila','Diego','Rosa','Pedro','Mario'][Math.floor(Math.random()*7)] + ' ' + ['A.','G.','L.','M.','R.','S.'][Math.floor(Math.random()*6)],
          amount: [1000,3000,5000,15000,25000,50000][Math.floor(Math.random()*6)],
          ts: Date.now(),
          city: cities[Math.floor(Math.random()*cities.length)]
        };
        return [nw, ...w].slice(0, 8);
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const [streak, setStreak] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  /* ===== Sonidos ===== */
  const sTap = useOneShotSound('/sfx/tap.wav', .6);
  const sWin = useOneShotSound('/sfx/win.wav', .9);
  const scratchLoop = useLoopSound('/sfx/scratch_loop.wav', .20);
  const bgm = useBgm('/sfx/bgm.wav', .22);
  useEffect(() => { installGlobalAudioUnlock([() => sTap.play(), () => bgm.play()]); }, []);

  /* ===== Canvas size / redraw ===== */
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current, k = coverRef.current, box = containerRef.current;
      if (!c || !k || !box) return;
      const w = Math.min(900, box.clientWidth);
      const h = PRIZE_CANVAS_HEIGHT;
      c.width = w; c.height = h;
      k.width = w; k.height = h;

      drawCover();
      drawPrizeLayer(cleanPrizeText(currentPrize?.label ?? 'RASCA Y REVELA EL PREMIO'));
    };
    resize();
    const ro = new (window as any).ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [currentPrize]);

  async function ensurePrizeFont(px: number) { try { await (document as any).fonts?.load(`800 ${px}px ${PRIZE_FONT_FAMILY}`); } catch {} }

  const drawPrizeLayer = async (text: string) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, '#140E24'); bg.addColorStop(1, '#22173D');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);

    const PAD = Math.round(Math.min(c.width, c.height) * 0.08);
    const maxW = c.width - PAD * 2;
    const maxH = c.height - PAD * 2;
    const targetAR = 16 / 9;
    let tw = maxW, th = tw / targetAR;
    if (th > maxH) { th = maxH; tw = th * targetAR; }
    const tx = (c.width - tw) / 2, ty = (c.height - th) / 2;
    const radius = Math.min(22, Math.round(th * 0.10));

    const plate = ctx.createLinearGradient(tx, ty, tx, ty + th);
    plate.addColorStop(0, '#2B2147'); plate.addColorStop(1, '#171235');
    ctx.save();
    ctx.beginPath();
    const r = radius;
    ctx.moveTo(tx + r, ty); ctx.lineTo(tx + tw - r, ty);
    ctx.quadraticCurveTo(tx + tw, ty, tx + tw, ty + r);
    ctx.lineTo(tx + tw, ty + th - r);
    ctx.quadraticCurveTo(tx + tw, ty + th, tx + tw - r, ty + th);
    ctx.lineTo(tx + r, ty + th);
    ctx.quadraticCurveTo(tx, ty + th, tx, ty + th - r);
    ctx.lineTo(tx, ty + r);
    ctx.quadraticCurveTo(tx, ty, tx + r, ty);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.30)'; ctx.shadowBlur = 16;
    ctx.fillStyle = plate; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(246,204,59,.35)'; ctx.stroke();
    ctx.restore();

    let drewImage = false;
    if (USE_PRIZE_IMAGES) {
      try {
        const key = keyFromLabel(text);
        const img = await loadPrizeImage(key);
        const innerPad = Math.round(th * 0.12);
        const iwMax = tw - innerPad * 2;
        const ihMax = th - innerPad * 2;
        const s = Math.min(iwMax / img.width, ihMax / img.height);
        const iw = img.width * s, ih = img.height * s;
        const ix = tx + (tw - iw) / 2, iy = ty + (th - ih) / 2;
        ctx.globalAlpha = 0.98; ctx.drawImage(img, ix, iy, iw, ih); ctx.globalAlpha = 1;
        drewImage = true;
      } catch {}
    }

    if (!drewImage) {
      const fontPx = Math.floor(tw * 0.16);
      await ensurePrizeFont(fontPx);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(246,204,59,.26)'; ctx.shadowBlur = 10;
      ctx.lineWidth = Math.max(2, Math.floor(fontPx * 0.06)); ctx.strokeStyle = '#8F6A17';
      const tg = ctx.createLinearGradient(0, ty, 0, ty + th);
      tg.addColorStop(0, '#FFF0C0'); tg.addColorStop(1, '#F6CC3B');
      ctx.fillStyle = tg; ctx.font = `800 ${fontPx}px ${PRIZE_FONT_FAMILY}`;
      const cx = tx + tw / 2, cy = ty + th / 2;
      ctx.strokeText(text, cx, cy); ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
    }
  };

  const drawCover = () => {
    const k = coverRef.current; if (!k) return;
    const kctx = k.getContext('2d'); if (!kctx) return;
    kctx.globalCompositeOperation = 'source-over';
    kctx.clearRect(0, 0, k.width, k.height);

    kctx.fillStyle = '#17122D'; kctx.fillRect(0, 0, k.width, k.height);
    kctx.fillStyle = '#2A1F4D';
    for (let i = 0; i < Math.floor((k.width * k.height) / 1100); i++) {
      const x = Math.random() * k.width, y = Math.random() * k.height;
      const r = 2.6 + Math.random() * 2.2;
      kctx.beginPath(); kctx.arc(x, y, r, 0, Math.PI * 2); kctx.fill();
    }
    kctx.globalCompositeOperation = 'destination-out';
    setScratchedPct(0);
  };

  /* ===== Scratch input ===== */
  const [isScratching, setIsScratching] = useState(false);
  const vib = (pattern: number | number[]) => { if ('vibrate' in navigator) { try { navigator.vibrate(pattern as any); } catch {} } };

  const computeScratched = () => {
    const k = coverRef.current; if (!k) return 0;
    const kctx = k.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!kctx) return 0;
    const img = kctx.getImageData(0, 0, k.width, k.height);
    const total = img.data.length / 4;
    let clear = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 0) clear++;
    return clear / total;
  };

  const scratchAt = (clientX: number, clientY: number) => {
    const k = coverRef.current; if (!k) return;
    const rect = k.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const kctx = k.getContext('2d'); if (!kctx) return;
    kctx.beginPath(); kctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2); kctx.fill();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || revealed) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setIsScratching(true);
    scratchAt(e.clientX, e.clientY);
    scratchLoop.play(); vib(10);
  };
  let lastVib = 0;
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || revealed || !isDrawingRef.current) return;
    e.preventDefault();
    scratchAt(e.clientX, e.clientY);
    const now = performance.now();
    if (now - lastVib > 120) { vib(5); lastVib = now; }
    if (Math.random() < 0.18) {
      const pct = computeScratched();
      setScratchedPct(pct);
      if (pct >= 0.55) doReveal();
    }
  };
  const endScratch = () => { isDrawingRef.current = false; setIsScratching(false); scratchLoop.stop(); };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || revealed) return;
    e.preventDefault();
    endScratch();
    const pct = computeScratched();
    setScratchedPct(pct);
    if (pct >= 0.55) doReveal();
  };

  /* ===== Helpers ===== */
  const maskName = () => {
    const first = ['María','Juan','Pedro','Ana','Luis','Camila','Diego','Sol','Rosa','Mario'];
    const last = ['G.','A.','L.','R.','M.','P.','N.','V.','D.','S.'];
    return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * first.length)]}`;
  };

  // MISMO RNG local para DEMO y REAL
  function pickPrizeLocal(mode: 'demo'|'real'): Prize {
    const expectedReturn =
      LOCAL_PRIZES.reduce((s,p)=> s + (p.payout * p.weight), 0) /
      LOCAL_PRIZES.reduce((s,p)=> s + p.weight, 0);

    const needNoPrizeProb = Math.min(
      0.80,
      Math.max(0.05, 1 - ((expectedReturn / TICKET_PRICE) - HOUSE_EDGE))
    );
    const noPrizeWeight = Math.round(needNoPrizeProb * 1000);

    const key = mode === 'demo' ? 'demo_plays' : 'real_plays';
    const plays = parseInt(localStorage.getItem(key) || '0', 10);
    // Primeras jugadas más amables en ambos modos
    if (plays === 0 || plays === 2) {
      const small = [LOCAL_PRIZES[0], LOCAL_PRIZES[1], LOCAL_PRIZES[2]];
      const pick = small[Math.floor(Math.random() * small.length)];
      localStorage.setItem(key, String(plays + 1));
      return { ...pick, weight: 0 };
    }

    const bag: Prize[] = [
      ...LOCAL_PRIZES,
      { label: '💸 ₲0', payout: 0, weight: noPrizeWeight }
    ];
    const total = bag.reduce((s,p)=> s + p.weight, 0);
    let r = Math.random() * total;
    let chosen = bag[0];
    for (const p of bag) { if ((r -= p.weight) <= 0) { chosen = p; break; } }
    localStorage.setItem(key, String(plays + 1));
    return chosen;
  }

  /* ===== Reveal / Comprar ===== */
  const doReveal = () => {
    setRevealed(true);
    setIsActive(false);
    setIsScratching(false);
    scratchLoop.stop();

    const paid = currentPrize?.payout ?? 0;

    if (paid > 0) {
      const big = paid >= 10000;
      sWin.play();
      if (!useDemo && big) {
        setWinners(w => [{ name: maskName(), amount: paid, ts: Date.now() }, ...w].slice(0, 8));
      }
      boomConfetti(wrapRef.current, { gold: true, power: big ? 1.6 : 1.2 });
      if ('vibrate' in navigator) try { navigator.vibrate(big ? [12, 100, 12] : 18); } catch {}
      if (useDemo) setDemoBalance(b => b + paid);
      else setRealBalance(b => Math.max(0, b + paid));
      setMessage(`¡Ganaste ${formatGs(paid)}! 🎉${useDemo ? ' (demo)' : ''}`);
      setStreak(0);
    } else {
      setStreak(s => Math.min(s + 1, 6));
      setMessage(`¡SIN PREMIO! Probá de nuevo ✨${useDemo ? ' (demo)' : ''}`);
    }
  };

  const buyTicket = async () => {
    if (isActive) return;

    const playingDemo = useDemo || !allowReal;

    if (playingDemo) {
      if (demoBalance < TICKET_PRICE) {
        setMessage('Saldo DEMO insuficiente. Reiniciado a ₲25.000 para seguir probando.');
        setDemoBalance(25_000);
        return;
      }
    } else {
      if (!userId) { setMessage('Iniciá sesión para jugar con saldo real.'); return; }
      if (realBalance < TICKET_PRICE) { setMessage('Saldo REAL insuficiente.'); return; }
    }

    setIsActive(true);
    setMessage('');
    setIsScratching(false);

    // MISMO esquema para ambos modos
    const mode: 'demo'|'real' = playingDemo ? 'demo' : 'real';
    const p = pickPrizeLocal(mode);
    setCurrentPrize({ label: p.label, payout: p.payout, weight: 0 });
    setTimeout(() => { drawCover(); drawPrizeLayer(cleanPrizeText(p.label)); }, 0);

    if (mode === 'demo') setDemoBalance(b => b - TICKET_PRICE);
    else {
      setRealBalance(b => Math.max(0, b - TICKET_PRICE));
      // crecer jackpot localmente de forma simple
      setJackpot(j => j + Math.round(TICKET_PRICE * 0.08));
    }
    setRevealed(false);
  };

  const visiblePrizeText = revealed && currentPrize ? currentPrize.label : '—';
  const shortEmail = userEmail ? (userEmail.length > 26 ? `${userEmail.slice(0, 12)}…${userEmail.slice(-10)}` : userEmail) : null;

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (isActive && !revealed) el.classList.add('active'); else el.classList.remove('active');
  }, [isActive, revealed]);

  const showHint = !revealed && !isScratching;

  const winnersMarquee = winners
    .slice(0, 6)
    .map(w => `${w.name} ganó ${formatGs(w.amount)} — ${w.city ?? 'PY'} • ${new Date(w.ts).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}`)
    .join('   •   ');

  return (
    <div ref={wrapRef} className="container" style={{ position: 'relative' }}>
      {/* HEADER */}
      <div className="header header-responsive">
        <div className="left">
          <div className="logo">🎰</div>
          <div className="brand"><span>Ras</span><span className="text-gold">Pay</span></div>
        </div>

        <div className="right">
          <button className="btn btn-pill" onClick={bgm.toggle} title={bgm.enabled ? 'Silenciar música' : 'Activar música'}>
            {bgm.enabled ? '🔊 Música' : '🔇 Mudo'}
          </button>

          {userId ? (
            <div className="mode-switch">
              <button className={`chip ${useDemo ? 'active' : ''}`} onClick={() => setUseDemo(true)} title="Jugar con saldo DEMO">DEMO</button>
              <button
                className={`chip ${!useDemo ? 'active' : ''}`}
                onClick={() => setUseDemo(false)}
                title="Jugar con saldo REAL"
                disabled={!allowReal}
              >
                REAL
              </button>
            </div>
          ) : (
            <span className="btn btn-pill">DEMO</span>
          )}

          {shortEmail ? (
            <div className="auth-chips">
              <span className="btn btn-pill email" title={userEmail || ''}>👤 {shortEmail}</span>
              {(role === 'admin' || role === 'cashier') && (<span className="btn btn-pill">🔑 {role}</span>)}
              <button className="btn btn-gold" onClick={goToPanel}>Ir a mi perfil</button>
              <button className="btn" onClick={handleSignOut}>Salir</button>
            </div>
          ) : (
            <a href="/login" className="btn btn-gold">Iniciar sesión</a>
          )}
        </div>
      </div>

      {/* HERO */}
      <div className="card-strong hero" style={{ marginBottom: 16 }}>
        <h1 className="shiny-headline">RASCÁ Y GANÁ <span className="text-gold">AL INSTANTE</span></h1>
        <p className="text-muted" style={{ maxWidth: 900, marginTop: 8 }}>
          Tickets desde <b>{formatGs(TICKET_PRICE)}</b> · Pagos verificados · +{Math.max(6, winners.length)} ganadores hoy
        </p>
        <div className="hero-ctas">
          <button className="btn btn-gold pulse" onClick={buyTicket} disabled={isActive}>{isActive ? 'Rascá ahora' : 'Rascar gratis ahora'}</button>
          <span className="badge-countdown">Bonus +{bonusPct}% <span className="sep">•</span> {bonusLeft}</span>
        </div>
        <div className="marquee"><span>{winnersMarquee}</span></div>
      </div>

      {/* GRID */}
      <div className="main-grid">
        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-jackpot">
            <div className="small">JACKPOT ACTUAL</div>
            <div className="card-number">{formatGs(jackpot)}</div>
            <div className="small">Crece con cada jugada real.</div>
          </div>

          <div className="card card-active">
            <div className="small">SALDO DEMO</div>
            <div className="card-number">{formatGs(demoBalance)}</div>
            <div className="small">Ideal para probar sin registro.</div>
          </div>

          {userId && (
            <div className={`card ${!useDemo ? 'card-active' : ''}`}>
              <div className="small" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>SALDO REAL</span>
                <button className="btn btn-pill" onClick={() => userId && loadRealBalance(userId)} title="Actualizar saldo">Actualizar</button>
              </div>
              <div className="card-number">{formatGs(realBalance)}</div>
              <div className="small">Acreditación por cajero verificado.</div>
              {!allowReal && userId && (
                <div className="small" style={{opacity:.8}}>Necesitás al menos {formatGs(TICKET_PRICE)} para jugar en REAL.</div>
              )}
            </div>
          )}

          <div className="card card-cost">
            <div className="small">COSTO POR TICKET</div>
            <div className="card-number">{formatGs(TICKET_PRICE)}</div>
          </div>

          <div className="card card-winners">
            <div className="small" style={{ marginBottom: 8 }}>GANADORES RECIENTES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
              {winners.slice(0,6).map((w, i) => (
                <React.Fragment key={i}>
                  <div>{w.name} · <span className="text-muted">{w.city ?? 'PY'}</span></div>
                  <div style={{ fontWeight: 800 }}>{formatGs(w.amount)}</div>
                </React.Fragment>
              ))}
            </div>
            <div className="sparkles" aria-hidden />
          </div>

          <div className="card card-streak">
            <div className="small">RACHA</div>
            <div className="streak-text">
              {streak === 0 ? '¡En racha positiva! ✨' : `${streak} sin premio`}
            </div>
            {streak >= 4 && <div className="boost-chip">¡Próxima jugada con boost!</div>}
          </div>
        </div>

        {/* Derecha: juego */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {visiblePrizeText}{useDemo ? ' (demo)' : ''}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={buyTicket} className="btn btn-gold" disabled={isActive}>{isActive ? 'Rascá ahora' : 'Rascar'}</button>
              <span className="btn btn-pill" style={{ fontSize: 12 }}>Bonus +{bonusPct}%</span>
              <span className="btn btn-pill" style={{ fontSize: 12 }}>{useDemo ? 'Dinero DEMO' : 'Dinero REAL'}</span>
            </div>
          </div>

          <div ref={containerRef} className="scratch-wrap card">
            <div className="relative" style={{ position: 'relative' }}>
              <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 20 }} />
              <canvas
                ref={coverRef}
                className="scratch-cover"
                style={{ position: 'absolute', inset: 0, borderRadius: 20, opacity: revealed ? 0 : 1, width: '100%', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={endScratch}
                onPointerLeave={() => { if (isDrawingRef.current) endScratch(); }}
              />
              {showHint && (
                <div className="scratch-hint" aria-hidden>
                  <span className="hint-finger">👆</span>
                  <span className="hint-text">RASCA Y REVELA EL PREMIO</span>
                </div>
              )}
            </div>
            <div className="small" style={{ marginTop: 8 }}>Rascado: {(scratchedPct * 100).toFixed(0)}%</div>
            {message && <div className="card" style={{ marginTop: 12 }}>{message}</div>}
          </div>
        </div>
      </div>

      {/* Tutorial overlay */}
      {showTutorial && (
        <div className="tutorial">
          <div className="tutorial-card">
            <div className="t-title">¿Cómo se juega?</div>
            <ol>
              <li>Tocá el recuadro y <b>raspá la lámina</b>.</li>
              <li>Al llegar al 55% se revela el <b>premio</b> al instante.</li>
            </ol>
            <button className="btn btn-gold" onClick={closeTutorial}>¡Entendido!</button>
          </div>
        </div>
      )}

      {/* Footer legal */}
      <footer className="legal">
        <div>© {new Date().getFullYear()} RasPay · +18 · Juego responsable</div>
        <div><a href="/tyc">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/contacto">Contacto</a></div>
      </footer>

      {/* Sticky CTA mobile */}
      <div className="sticky-cta">
        <button className="btn btn-gold" onClick={buyTicket} disabled={isActive}>{isActive ? 'Rascá ahora' : 'Rascar gratis ahora'}</button>
      </div>

      {/* CSS */}
      <style jsx global>{`
        :root{
          --bg-1:#0E0A1B; --bg-2:#140E24;
          --violet-2:#22173D; --violet-3:#2B2147; --violet-4:#171235;
          --gold:#F6CC3B; --gold-deep:#8F6A17;
        }
        html, body { overscroll-behavior: none; background: radial-gradient(120% 120% at 10% -10%, rgba(246,204,59,.06), transparent 50%), var(--bg-1); }

        .text-gold{ color: var(--gold); }
        .text-muted{ color:#cbd5e1; opacity:.85; }

        .btn{ padding:8px 12px; border-radius:10px; background:#1f1836; color:#e5e7eb; border:1px solid rgba(255,255,255,.08); font-weight:700; }
        .btn[disabled]{ opacity:.6; cursor:not-allowed; }
        .btn.btn-gold{ background: linear-gradient(180deg,#FFE69A,#F6CC3B); color:#2b1d00; border:1px solid rgba(246,204,59,.45); }
        .btn.btn-gold.pulse:not([disabled]) { animation: rp-pulse 1.8s ease-in-out infinite; }
        @keyframes rp-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        .btn.btn-pill{ border-radius:9999px; padding:6px 12px; }

        .header-responsive{ position: static; z-index: 1;
          display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;
          margin-bottom:12px; padding:10px 0; }
        .header-responsive .left{ display:flex; align-items:center; gap:10px; }
        .header-responsive .brand{ font-weight:900; font-size:20px; }
        .header-responsive .right{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .auth-chips{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .auth-chips .email{ max-width: 280px; overflow:hidden; text-overflow:ellipsis; }

        .mode-switch{ display:flex; background:#1a1432; border-radius:9999px; padding:3px; border:1px solid rgba(255,255,255,.06); }
        .mode-switch .chip{ padding:6px 12px; border-radius:9999px; font-weight:800; font-size:12px; color:#cbd5e1; background:transparent; border:none; }
        .mode-switch .chip.active{ color:#2b1d00; background: linear-gradient(180deg,#FFE69A,#F6CC3B); border:1px solid rgba(246,204,59,.45); }

        .shiny-headline{
          font-size:40px; font-weight:900; letter-spacing:.5px;
          background: linear-gradient(90deg,#ffffff 0%, var(--gold) 65%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          text-shadow: 0 2px 0 rgba(0,0,0,.35);
        }

        .hero-ctas{ display:flex; gap:12px; align-items:center; margin-top:12px; flex-wrap:wrap; }
        .badge-countdown{ font-weight:800; font-size:12px; padding:6px 10px; border-radius:9999px; border:1px solid rgba(246,204,59,.35); color:#fff; background:rgba(20,14,36,.6); }
        .badge-countdown .sep{ opacity:.6; margin:0 6px; }

        .marquee{ overflow:hidden; white-space:nowrap; margin-top:10px; font-size:12px; opacity:.85; }
        .marquee span{ display:inline-block; padding-left:100%; animation: slide 22s linear infinite; }
        @keyframes slide { 0%{ transform: translateX(0); } 100%{ transform: translateX(-100%); } }

        .card-strong, .card{
          background: linear-gradient(180deg, var(--violet-2) 0%, var(--violet-4) 100%);
          border:1px solid rgba(255,255,255,.06);
          border-radius:20px; padding:14px;
        }
        .hero{ padding:18px; }
        .card-active{ outline: 2px solid rgba(246,204,59,.35); }

        .card-number{ font-weight:900; font-size:28px }
        .card-jackpot{
          background: linear-gradient(180deg, var(--violet-3) 0%, var(--violet-4) 100%);
          border:1px solid rgba(246,204,59,.22);
          box-shadow: 0 0 18px rgba(246,204,59,.08) inset, 0 0 18px rgba(246,204,59,.05);
        }
        .card-cost{ border:1px solid rgba(99,102,241,.18); }
        .card-winners{ position:relative; border:1px solid rgba(246,204,59,.12); }
        .card-winners .sparkles{
          position:absolute; inset:0; pointer-events:none;
          background:
            radial-gradient(2px 2px at 20% 30%, rgba(246,204,59,.55), transparent 60%),
            radial-gradient(1.6px 1.6px at 60% 20%, rgba(255,255,255,.4), transparent 60%),
            radial-gradient(1.8px 1.8px at 80% 65%, rgba(246,204,59,.35), transparent 60%),
            radial-gradient(1.4px 1.4px at 35% 75%, rgba(255,255,255,.38), transparent 60%);
          animation: twinkle 3.2s ease-in-out infinite; opacity:.55;
        }

        .card-streak{ border:1px solid rgba(246,204,59,.12); }

        .scratch-wrap { box-shadow: 0 0 0 0 rgba(246,204,59,.35); transition: box-shadow .3s; border-radius:20px; }
        .scratch-wrap.active { box-shadow: 0 0 28px 0 rgba(246,204,59,.28); }
        .scratch-wrap canvas { display:block; }
        .scratch-wrap .relative { border-radius:20px; overflow:hidden; }
        .scratch-cover { touch-action: none; }

        .scratch-hint{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
        .scratch-hint .hint-text{
          font-weight:900; letter-spacing:.14em; text-transform:uppercase;
          font-size: clamp(16px, 3.1vw, 28px);
          padding: 12px 22px; border-radius:9999px; color:#fff;
          background: rgba(18,13,35,.80); border:1px solid rgba(246,204,59,.30);
          box-shadow: 0 8px 28px rgba(0,0,0,.35), inset 0 0 0.5px rgba(255,255,255,.08);
          backdrop-filter: blur(2px); animation: hint-glide 2.2s ease-in-out infinite;
        }
        .scratch-hint .hint-finger{ margin-right:12px; font-size: clamp(18px, 3.2vw, 30px); transform: translateY(-2px); animation: finger-bounce 1.6s ease-in-out infinite; }
        @keyframes hint-glide { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes finger-bounce { 0%,100%{transform:translateY(-1px)} 50%{transform:translateY(2px)} }

        .tutorial{ position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:50; }
        .tutorial-card{ width:min(520px,90vw); background:linear-gradient(180deg,#22173D,#171235); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; }
        .tutorial-card .t-title{ font-weight:900; font-size:20px; margin-bottom:10px; }
        .tutorial-card ol{ margin:0 0 14px 18px; }
        .tutorial-card li{ margin-bottom:6px; }

        .legal{ margin:26px 0 80px; display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; font-size:12px; opacity:.8; }
        .legal a{ text-decoration:underline; }

        .sticky-cta{ position:fixed; left:0; right:0; bottom:10px; display:none; justify-content:center; z-index:40; }
        .sticky-cta .btn{ width:92%; max-width:420px; }

        @media (max-width: 640px){
          .header-responsive{ align-items:flex-start; padding-top:6px; padding-bottom:6px; }
          .right{ width:100%; display:flex; flex-wrap:wrap; gap:8px; }
          .auth-chips{ width:100%; }
          .auth-chips .email{ width:100%; justify-content:flex-start; }
          .sticky-cta{ display:flex; }
        }
      `}</style>
    </div>
  );
}

/* ===== Export como página, desactivando SSR ===== */
const SafeGame = dynamic(() => Promise.resolve(Game), { ssr: false });
export default function Page() {
  return <SafeGame />;
}
