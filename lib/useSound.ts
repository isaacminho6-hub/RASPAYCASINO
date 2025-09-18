import { useMemo } from 'react';

type Opts = { volume?: number };

export default function useSound(src: string, opts: Opts = {}) {
  const { volume = 1 } = opts;

  const audio = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = Math.max(0, Math.min(1, volume));
    return a;
  }, [src, volume]);

  return (rate = 1) => {
    try {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      (audio as any).playbackRate = rate;
      audio.play();
    } catch {}
  };
}
