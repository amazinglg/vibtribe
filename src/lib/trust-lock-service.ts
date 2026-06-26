/**
 * TrustLockService — unified, platform-agnostic abstraction layer for the
 * Trust Lock privacy feature. The chat layer calls `enableProtection()` /
 * `disableProtection()` without caring about the host platform; this module
 * routes the call to the strongest protections that platform allows:
 *
 *   Android  →  WindowManager.LayoutParams.FLAG_SECURE via the native
 *               `VtTrustLock` Capacitor plugin.
 *               Blocks screenshots, screen recording and the recent-apps
 *               preview thumbnail at the OS level.
 *
 *   iOS      →  `VtTrustLock` Capacitor plugin (Swift) registered by the
 *               iOS wrapper. Apple does NOT allow blocking screenshots, so
 *               we implement the strongest legal protections:
 *                 • UIApplication.userDidTakeScreenshotNotification
 *                   → emits `screenshotTaken` so the chat can post a
 *                     "🛡️ Screenshot detected on this device" system event.
 *                 • UIScreen.capturedDidChangeNotification
 *                   → overlays a blur view while screen recording is active
 *                     so the capture only sees an opaque blur.
 *                 • willResignActive → adds a blur overlay so the
 *                   app-switcher snapshot is obscured. Removed on
 *                   didBecomeActive.
 *
 *   Web/PWA  →  No userland API can block OS screenshots. We apply a
 *               body-level CSS attribute (`data-trust-lock-bg`) on
 *               visibilitychange/blur so the app-switcher snapshot tends to
 *               capture a blurred frame, and rely on the in-app UI
 *               restrictions (hidden download/share, blocked context menus,
 *               disablePictureInPicture, controlsList="nodownload") for the
 *               rest of the protection surface.
 *
 * The service is intentionally a singleton — only one chat at a time is the
 * "active" Trust-Locked chat, and we always call `disableProtection()` on
 * teardown so other chats / the rest of the app are unaffected.
 */

import { setAndroidSecureFlag } from './native-bridge';

export type TrustLockPlatform = 'android' | 'ios' | 'pwa' | 'web';

/** Capacitor handle attached by the native WebView. */
interface CapacitorHandle {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, IosTrustLockPlugin | undefined>;
}

/** Shape of the iOS-native `VtTrustLock` Capacitor plugin. */
interface IosTrustLockPlugin {
  enable: () => Promise<{ enabled: boolean }>;
  disable: () => Promise<{ enabled: boolean }>;
  isActive: () => Promise<{ active: boolean }>;
  addListener: (
    event: 'screenshotTaken' | 'screenRecordingChanged',
    cb: (data: { active?: boolean; timestamp?: number }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

function getCapacitor(): CapacitorHandle | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorHandle }).Capacitor ?? null;
}

export function detectTrustLockPlatform(): TrustLockPlatform {
  if (typeof window === 'undefined') return 'web';
  // Legacy Android bridge source of truth. This covers older wrappers where
  // Capacitor platform metadata may not be present but MainActivity injected
  // the screenshot-blocking interface.
  if ((window as unknown as { VtTrustLock?: unknown }).VtTrustLock) return 'android';
  const cap = getCapacitor();
  if (cap?.isNativePlatform?.() && cap.getPlatform) {
    const p = cap.getPlatform();
    if (p === 'ios') return 'ios';
    if (p === 'android') return 'android';
  }
  // TWA / installed PWA — treated like web for capability purposes, but we
  // tag separately so future native shims (e.g. an iOS PWA Push) can hook in.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}

/** True for iOS native app AND iOS PWA. False for Android, desktop web, Android PWA. */
export function isIOS(): boolean {
  const platform = detectTrustLockPlatform();
  if (platform === 'ios') return true;
  if (platform === 'pwa' && typeof navigator !== 'undefined') {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  return false;
}

/** True ONLY for an iOS device running the app as an installed PWA / Safari web — NOT the native Capacitor iOS app. */
export function isIosPwa(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = detectTrustLockPlatform();
  if (platform === 'ios') return false; // native iOS app
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Best-effort iOS PWA screenshot heuristic. Apple does not expose a
 * screenshot API to web content, so we cannot detect with certainty.
 * Heuristic: taking a screenshot on iOS triggers a brief window `blur`
 * (the screenshot preview UI takes focus) followed by a `focus` within
 * a short window, WITHOUT the document going to `visibilityState=hidden`
 * (an app switch always sets visibility to hidden).
 */
function setupIosPwaScreenshotHeuristic(): () => void {
  if (typeof window === 'undefined') return () => {};
  let blurredAt = 0;
  let wentHiddenAfterBlur = false;
  let lastEmit = 0;
  const onBlur = () => { blurredAt = Date.now(); wentHiddenAfterBlur = false; };
  const onVis = () => { if (document.visibilityState === 'hidden') wentHiddenAfterBlur = true; };
  const onFocus = () => {
    if (!blurredAt) return;
    const dt = Date.now() - blurredAt;
    const wasShort = dt > 0 && dt < 1500;
    if (wasShort && !wentHiddenAfterBlur) {
      const now = Date.now();
      if (now - lastEmit > 2000) {
        lastEmit = now;
        window.dispatchEvent(new CustomEvent('vt-trust-lock-screenshot', { detail: { platform: 'ios-pwa', heuristic: true } }));
      }
    }
    blurredAt = 0;
    wentHiddenAfterBlur = false;
  };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVis);
  };
}

async function getIosPlugin(): Promise<IosTrustLockPlugin | null> {
  if (detectTrustLockPlatform() !== 'ios') return null;
  const plugin = getCapacitor()?.Plugins?.VtTrustLock;
  return (plugin as IosTrustLockPlugin | undefined) ?? null;
}

let isActive = false;
let desiredProtection = false;
let operationSeq = 0;
let cleanupFns: Array<() => void | Promise<void>> = [];

function setupWebBackgroundBlur(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onHide = () => document.documentElement.setAttribute('data-trust-lock-bg', 'true');
  const onShow = () => document.documentElement.removeAttribute('data-trust-lock-bg');
  const onVis = () => (document.visibilityState === 'hidden' ? onHide() : onShow());
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  window.addEventListener('blur', onHide);
  window.addEventListener('focus', onShow);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
    window.removeEventListener('blur', onHide);
    window.removeEventListener('focus', onShow);
    document.documentElement.removeAttribute('data-trust-lock-bg');
  };
}

export const TrustLockService = {
  getPlatform: detectTrustLockPlatform,
  isProtectionActive: () => isActive,

  async enableProtection(): Promise<boolean> {
    const seq = ++operationSeq;
    desiredProtection = true;
    const platform = detectTrustLockPlatform();

    if (platform === 'android') {
      const enabled = await setAndroidSecureFlag(true);
      if (seq !== operationSeq && !desiredProtection) {
        await setAndroidSecureFlag(false).catch(() => false);
        return false;
      }
      if (!enabled) {
        isActive = false;
        console.warn('[TrustLock] Android native secure flag was not applied.');
        return false;
      }
    } else if (platform === 'ios') {
      const plugin = await getIosPlugin();
      if (plugin) {
        try { await plugin.enable(); } catch (e) { console.warn('[TrustLock] iOS enable failed', e); }
        try {
          const sl1 = await plugin.addListener('screenshotTaken', () => {
            window.dispatchEvent(new CustomEvent('vt-trust-lock-screenshot', {
              detail: { platform: 'ios' },
            }));
          });
          const sl2 = await plugin.addListener('screenRecordingChanged', (e) => {
            const active = !!e?.active;
            if (active) document.documentElement.setAttribute('data-trust-lock-recording', 'true');
            else document.documentElement.removeAttribute('data-trust-lock-recording');
            window.dispatchEvent(new CustomEvent('vt-trust-lock-recording', {
              detail: { platform: 'ios', active },
            }));
          });
          cleanupFns.push(async () => { try { await sl1.remove(); } catch {} });
          cleanupFns.push(async () => { try { await sl2.remove(); } catch {} });
        } catch (e) {
          console.warn('[TrustLock] iOS listener setup failed', e);
        }
      } else {
        console.warn('[TrustLock] iOS plugin VtTrustLock is not registered — falling back to web-only protections.');
      }
    }

    // iOS PWA only: install best-effort screenshot heuristic so the chat
    // layer can log "screenshot detected" system events even without the
    // native plugin. Android & native iOS already covered above.
    if (isIosPwa()) {
      cleanupFns.push(setupIosPwaScreenshotHeuristic());
    }

    // Always apply web-level backgrounding blur as a defence-in-depth layer.
    // On Android the OS preview is already suppressed by FLAG_SECURE; on iOS
    // the native plugin paints a real UIBlurEffect for the snapshot. The CSS
    // path is a best-effort fallback for PWA / web and adds no harm where
    // native protection already exists.
    if (!isActive) cleanupFns.push(setupWebBackgroundBlur());
    isActive = true;

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-trust-lock', 'active');
      document.documentElement.setAttribute('data-trust-lock-platform', platform);
    }
    if (platform !== 'android') {
      // iOS (native + PWA) cannot block screenshots at the OS level — Apple
      // does not expose that capability. We apply the strongest legal
      // protections (UIBlurEffect via the native plugin on iOS app, CSS
      // background blur + in-app UI restrictions on iOS PWA) and treat the
      // chat as protected so it is not hidden behind an Android-only wall.
      if (platform === 'ios' || isIOS()) {
        return true;
      }
      console.warn('[TrustLock] Screenshot blocking is only enforceable in the native Android app.');
      return false;
    }
    return true;
  },

  async disableProtection(): Promise<void> {
    const seq = ++operationSeq;
    desiredProtection = false;
    isActive = false;
    const platform = detectTrustLockPlatform();
    if (platform === 'android') await setAndroidSecureFlag(false);
    if (platform === 'ios') {
      const plugin = await getIosPlugin();
      if (plugin) {
        try { await plugin.disable(); } catch (e) { console.warn('[TrustLock] iOS disable failed', e); }
      }
    }
    for (const fn of cleanupFns) { try { await fn(); } catch {} }
    cleanupFns = [];
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-trust-lock');
      document.documentElement.removeAttribute('data-trust-lock-platform');
      document.documentElement.removeAttribute('data-trust-lock-recording');
      document.documentElement.removeAttribute('data-trust-lock-bg');
    }
    if (desiredProtection && seq !== operationSeq) {
      await TrustLockService.enableProtection();
    }
  },
};

/**
 * Subscribe to iOS screenshot events. The callback fires once per detected
 * screenshot while protection is enabled. Returns an unsubscribe fn.
 * No-op on platforms that don't support detection — the listener simply
 * never fires.
 */
export function onTrustLockScreenshot(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener('vt-trust-lock-screenshot', handler);
  return () => window.removeEventListener('vt-trust-lock-screenshot', handler);
}