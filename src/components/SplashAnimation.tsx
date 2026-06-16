import React, { useEffect, useState } from 'react';
import Wordmark from '@/components/ui/Wordmark';

/**
 * Brief 2-second animated splash shown once per browser session on first
 * load. Four overlapping coloured circles rotate around a centre while the
 * VibTribe wordmark fades / scales up. After ~2s it removes itself from
 * the DOM and reveals the real app underneath (loaded in parallel).
 */
const SESSION_KEY = 'vt_splash_shown';

export default function SplashAnimation() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      setVisible(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden animate-vt-splash-fadeout">
      <style>{`
        @keyframes vt-splash-fadeout { 0%,80%{opacity:1} 100%{opacity:0;visibility:hidden} }
        @keyframes vt-splash-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes vt-splash-spin-r  { from{transform:rotate(360deg)} to{transform:rotate(0deg)} }
        @keyframes vt-splash-pop     { 0%{opacity:0; transform:translateY(20px) scale(.7)} 60%{opacity:1; transform:translateY(0) scale(1.05)} 100%{opacity:1; transform:translateY(0) scale(1)} }
        @keyframes vt-splash-pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .vt-splash-stage { animation: vt-splash-pulse 2s ease-in-out infinite; }
        .vt-circle { mix-blend-mode: screen; filter: blur(2px); }
      `}</style>

      <div className="relative flex flex-col items-center gap-6">
        {/* Rotating circles cluster */}
        <div className="relative w-44 h-44 vt-splash-stage">
          <div
            className="absolute inset-0"
            style={{ animation: 'vt-splash-spin 1.4s cubic-bezier(.55,.05,.4,1) forwards' }}
          >
            {/* Top — purple */}
            <div
              className="vt-circle absolute left-1/2 top-0 -translate-x-1/2 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #c084fc, #7c3aed 70%)' }}
            />
            {/* Right — green/cyan */}
            <div
              className="vt-circle absolute right-0 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #5eead4, #10b981 70%)' }}
            />
            {/* Bottom — violet/blue */}
            <div
              className="vt-circle absolute left-1/2 bottom-0 -translate-x-1/2 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #a78bfa, #6366f1 70%)' }}
            />
            {/* Left — pink */}
            <div
              className="vt-circle absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #fda4af, #ec4899 70%)' }}
            />
          </div>
          {/* Counter-rotating subtle glow ring */}
          <div
            className="absolute inset-2 rounded-full border border-white/10"
            style={{ animation: 'vt-splash-spin-r 2s linear infinite' }}
          />
        </div>

        {/* Wordmark reveal at the end */}
        <div
          style={{ animation: 'vt-splash-pop 0.7s ease-out 1.2s both' }}
          className="text-center"
        >
          <Wordmark className="text-4xl" />
        </div>
      </div>
    </div>
  );
}