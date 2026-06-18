import React, { useEffect, useRef, useState } from 'react';
import splashVideo from '@/assets/splash.mp4.asset.json';

/**
 * Full-bleed intro splash shown once per browser session.
 *
 * UX rules (per product feedback):
 * - Background is the same near-black as the video letterbox so the video
 *   blends in with no visible borders, even on desktop / tablet where the
 *   720x1570 portrait clip doesn't fill the viewport.
 * - Use `object-contain` so the user always sees the FULL animation
 *   uncropped — never a zoomed-in fragment.
 * - Hold the splash on a black frame until the video has buffered enough
 *   to play through (`canplaythrough`) so we don't show the WebView's
 *   "tap to play" / pause glyph while the file is still loading.
 * - Dismiss only when the video naturally ends (or via a generous safety
 *   cap if the network fails). Fade out smoothly into the app underneath.
 */
const SESSION_KEY = 'vt_splash_shown';
const SAFETY_CAP_MS = 20000; // generous; real dismiss happens on `ended`
const FADE_MS = 450;

export default function SplashAnimation() {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Decide on the client whether to show the splash this session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {}
    setMounted(true);
  }, []);

  const dismiss = React.useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    setFading(true);
    window.setTimeout(() => setMounted(false), FADE_MS);
  }, []);

  // Kick playback as soon as the element exists; some WebViews need an
  // explicit play() call even with autoPlay.
  useEffect(() => {
    if (!mounted) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {/* ignored */});
    };
    tryPlay();
    const safety = window.setTimeout(dismiss, SAFETY_CAP_MS);
    return () => window.clearTimeout(safety);
  }, [mounted, dismiss]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: '#000',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        // @ts-expect-error - non-standard but respected by iOS/Android WebView
        webkit-playsinline="true"
        preload="auto"
        controls={false}
        disablePictureInPicture
        // @ts-expect-error - vendor attribute
        disableRemotePlayback
        onCanPlayThrough={() => setReady(true)}
        onEnded={dismiss}
        onError={dismiss}
        className="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none select-none"
        style={{
          opacity: ready ? 1 : 0,
          transition: 'opacity 250ms ease-out',
        }}
      />
    </div>
  );
}