import React, { useEffect, useRef, useState } from 'react';
import splashVideo from '@/assets/splash.mp4.asset.json';

/**
 * Brief 2-second animated splash shown once per browser session on first
 * load. Four overlapping coloured circles rotate around a centre while the
 * VibTribe wordmark fades / scales up. After ~2s it removes itself from
 * the DOM and reveals the real app underneath (loaded in parallel).
 */
const SESSION_KEY = 'vt_splash_shown';

export default function SplashAnimation() {
  // Always render null on SSR / first client render to avoid hydration mismatch.
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {}
    setVisible(true);
  }, []);

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    // Hard cap so a broken/slow video never blocks the app forever.
    const hardCap = setTimeout(dismiss, 6000);
    return () => clearTimeout(hardCap);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden animate-vt-splash-fadeout">
      <style>{`
        @keyframes vt-splash-fadeout { 0%,85%{opacity:1} 100%{opacity:0;visibility:hidden} }
      `}</style>
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="w-full h-full object-cover"
      />
    </div>
  );
}