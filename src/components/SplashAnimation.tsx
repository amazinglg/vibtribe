import React, { useEffect, useRef, useState } from 'react';
import splashVideo from '@/assets/splash.mp4.asset.json';

/**
 * Full-bleed intro splash shown once per browser session.
 *
 * Behaviour contract:
 * 1. Plays the full intro video uncropped (object-contain on a black canvas).
 * 2. If the video has not buffered enough to play through within
 *    BUFFER_GRACE_MS, we abort and fall straight through to the app so the
 *    user never stares at a frozen black screen on a flaky network.
 * 3. While the splash is on screen we show a thin progress bar plus a
 *    "Loading your chats…" caption so the user always has feedback about
 *    real loading work happening in the background.
 * 4. Hard safety cap dismisses the splash no matter what.
 */
const SESSION_KEY = 'vt_splash_shown';
const BUFFER_GRACE_MS = 800;    // if video can't start playing within 800ms -> skip
const SAFETY_CAP_MS   = 20000;  // absolute hard ceiling
const FADE_MS         = 450;

export default function SplashAnimation() {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady]     = useState(false); // canplaythrough fired
  const [fading, setFading]   = useState(false);
  const [progress, setProgress] = useState(0);   // 0..1 — buffer or playback
  const [caption, setCaption]   = useState('Preparing your VibTribe…');
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const dismissed = useRef(false);

  // Decide on the client whether to show the splash this session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {}
    // On native (Capacitor) the OS splash already covers cold boot — skip the
    // JS splash video so users don't see a black screen while it buffers.
    try {
      if (document.documentElement.getAttribute('data-native') === 'capacitor') {
        sessionStorage.setItem(SESSION_KEY, '1');
        return;
      }
    } catch {}
    setMounted(true);
  }, []);

  const dismiss = React.useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    setFading(true);
    window.setTimeout(() => setMounted(false), FADE_MS);
  }, []);

  // Drive playback, buffer-grace fallback and safety cap.
  useEffect(() => {
    if (!mounted) return;
    const v = videoRef.current;
    if (!v) {
      // No element at all — bail out so the app renders.
      dismiss();
      return;
    }

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay was blocked or media unsupported — fall through to app.
          dismiss();
        });
      }
    };
    tryPlay();

    // If we never reach canplaythrough within the grace window, skip the
    // splash and hand control to the app (which has its own chat skeleton).
    const graceTimer = window.setTimeout(() => {
      if (!ready && !dismissed.current) dismiss();
    }, BUFFER_GRACE_MS);

    const safetyTimer = window.setTimeout(dismiss, SAFETY_CAP_MS);

    // Buffer progress while waiting; playback progress once playing.
    const onProgress = () => {
      try {
        if (v.duration && v.buffered.length > 0) {
          const end = v.buffered.end(v.buffered.length - 1);
          setProgress(Math.min(1, end / v.duration));
        }
      } catch {}
    };
    const onTimeUpdate = () => {
      if (v.duration > 0) setProgress(Math.min(1, v.currentTime / v.duration));
    };
    v.addEventListener('progress', onProgress);
    v.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      window.clearTimeout(graceTimer);
      window.clearTimeout(safetyTimer);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [mounted, ready, dismiss]);

  // Rotate the caption so it feels alive while chats stream in the background.
  useEffect(() => {
    if (!mounted) return;
    const captions = [
      'Preparing your VibTribe…',
      'Loading your chats…',
      'Syncing recent messages…',
      'Almost there…',
    ];
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % captions.length;
      setCaption(captions[i]);
    }, 2200);
    return () => window.clearInterval(t);
  }, [mounted]);

  if (!mounted) return null;

  const pct = Math.round(progress * 100);

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
        {...({ 'webkit-playsinline': 'true' } as any)}
        preload="auto"
        controls={false}
        disablePictureInPicture
        {...({ disableRemotePlayback: true } as any)}
        onCanPlayThrough={() => setReady(true)}
        onLoadedData={() => {
          // Some Android WebViews never fire canplaythrough; loadeddata is
          // enough to start playing without stutter for a 14s clip.
          setReady(true);
        }}
        onEnded={dismiss}
        onError={dismiss}
        onStalled={() => { /* keep waiting; safety/grace timers handle it */ }}
        className="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none select-none"
        style={{
          opacity: ready ? 1 : 0,
          transition: 'opacity 250ms ease-out',
        }}
      />

      {/* Bottom progress / loading caption — visible across the whole splash
          so the user always sees something happening. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="mx-auto max-w-sm">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium tracking-wide text-white/70">
            <span className="truncate">{caption}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/80"
              style={{
                width: `${Math.max(4, pct)}%`,
                transition: 'width 300ms ease-out',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}