import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shows a non-blocking banner when the user is running an outdated
 * version of VibTribe in a context where auto-reload may have failed:
 *
 *  - Native iOS / Android app (Capacitor): compares the installed
 *    native shell version (App.getInfo().version) to the latest
 *    `app_releases.version`. If installed < latest → banner.
 *  - Installed PWA (display-mode: standalone) on iOS or Android:
 *    compares the bundle's build time (baked at build) to the latest
 *    release's `released_at`. If the bundle is older than the latest
 *    release by more than the grace window → banner.
 *  - Regular desktop / mobile web browsers: no banner — the
 *    ForceReleaseListener hard-reload path is reliable there.
 *
 * The banner is dismissable for the session.
 */

const DISMISS_KEY = 'vt_old_version_dismissed';
// Grace window for PWA staleness — only nag if the cached bundle is
// older than the latest release by this much (avoids flashing the
// banner immediately after a fresh release while caches settle).
const PWA_GRACE_MS = 30 * 60 * 1000; // 30 minutes

type Platform = 'ios-native' | 'android-native' | 'ios-pwa' | 'android-pwa' | null;

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    navigator: Navigator & { standalone?: boolean };
  };
  const ua = navigator.userAgent || '';
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isAndroidDevice = /Android/i.test(ua);

  if (w.Capacitor?.isNativePlatform?.()) {
    const p = w.Capacitor.getPlatform?.();
    if (p === 'ios') return 'ios-native';
    if (p === 'android') return 'android-native';
    return null;
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (w.navigator as any).standalone === true;

  if (!isStandalone) return null;
  if (isIOSDevice) return 'ios-pwa';
  if (isAndroidDevice) return 'android-pwa';
  return null;
}

// Lightweight semver-ish comparator: returns true when `a` < `b`.
// Handles strings like "1.1.1", "1.2", "r-1700000000".
function isOlder(a: string, b: string): boolean {
  const parse = (s: string) =>
    s.replace(/^v/i, '').split(/[.\-+]/).map((x) => {
      const n = parseInt(x, 10);
      return Number.isFinite(n) ? n : 0;
    });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

export default function OldVersionBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    const p = detectPlatform();
    if (!p) return;
    setPlatform(p);

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const { data: release } = await (supabase as any)
          .from('app_releases')
          .select('version, released_at')
          .order('released_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || !release) return;

        if (p === 'ios-native' || p === 'android-native') {
          try {
            const { App } = await import('@capacitor/app');
            const info = await App.getInfo();
            const installed = info?.version || '';
            if (installed && release.version && isOlder(installed, release.version)) {
              setShow(true);
            }
          } catch {
            // Plugin unavailable — skip silently.
          }
          return;
        }

        // PWA path: compare bundle build time to release time.
        const buildTimeStr = import.meta.env.VITE_BUILD_TIME as string | undefined;
        if (!buildTimeStr) return;
        const buildMs = Date.parse(buildTimeStr);
        const releaseMs = Date.parse(release.released_at);
        if (!Number.isFinite(buildMs) || !Number.isFinite(releaseMs)) return;
        if (releaseMs - buildMs > PWA_GRACE_MS) {
          setShow(true);
        }
      } catch {
        // Network / RLS errors — fail silent; banner is best-effort.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!show || !platform) return null;

  const downloadHref =
    platform === 'ios-native' || platform === 'ios-pwa'
      ? 'https://www.vibtribe.in/download/ios'
      : 'https://www.vibtribe.in/download/android';

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setShow(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[2000] px-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 shadow-lg backdrop-blur-md">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
          aria-hidden
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-50">Your app version is out of date</p>
          <p className="mt-0.5 leading-snug text-amber-100/90">
            You may miss new features and security improvements. Please install the latest version from our website.
          </p>
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-amber-950 transition-colors hover:bg-amber-300"
          >
            Install latest
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-1 rounded p-1 text-amber-200/80 transition-colors hover:bg-amber-500/20 hover:text-amber-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}