import React, { useEffect, useState } from 'react';
import splashVideo from '@/assets/splash.mp4.asset.json';

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
        @keyframes vt-splash-fadeout { 0%,85%{opacity:1} 100%{opacity:0;visibility:hidden} }
      `}</style>
      <video
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
      />
    </div>
  );
}