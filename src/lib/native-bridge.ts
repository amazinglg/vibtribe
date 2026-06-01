/**
 * Detect when VibTribe is running inside a native wrapper (Capacitor or
 * Android Trusted Web Activity) and tag <html data-native="..."> so CSS
 * can apply native-specific tweaks (stronger safe-area floors, etc.).
 *
 * Safe to call repeatedly. No-op during SSR.
 */
export function initNativeBridge(): 'capacitor' | 'twa' | 'browser' {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'browser';

  // --- Capacitor detection ---
  // Capacitor exposes `window.Capacitor` in its WebView. Works for both
  // remote-loaded (https://) and bundled (capacitor://) origins.
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  };
  const isCapacitor = !!w.Capacitor && (
    typeof w.Capacitor.isNativePlatform === 'function'
      ? w.Capacitor.isNativePlatform()
      : true
  );

  // --- TWA detection ---
  // Trusted Web Activity uses the Android Custom Tabs referrer header.
  const referrer = (document.referrer || '').toLowerCase();
  const isTWA = referrer.startsWith('android-app://')
    || (window.matchMedia?.('(display-mode: standalone)').matches
        && /android/i.test(navigator.userAgent)
        && !!referrer && referrer.includes('app.vibtribe'));

  let kind: 'capacitor' | 'twa' | 'browser' = 'browser';
  if (isCapacitor) kind = 'capacitor';
  else if (isTWA) kind = 'twa';

  document.documentElement.setAttribute('data-native', kind);

  // --- WebCrypto sanity check ---
  // Without `crypto.subtle` the E2E PIN flow cannot derive or decrypt keys.
  // If we ever load inside a WebView that downgraded the origin to http://
  // (Capacitor must use `androidScheme: 'https'`) we surface a clear error
  // instead of the cryptic "Failed to derive key" message users currently see.
  if (kind !== 'browser' && typeof crypto === 'undefined') {
    console.error('[VibTribe] window.crypto is undefined inside the native WebView. ' +
      'End-to-end encryption will not work. Ensure the wrapper loads VibTribe over HTTPS.');
  } else if (kind !== 'browser' && !crypto.subtle) {
    console.error('[VibTribe] crypto.subtle is undefined inside the native WebView. ' +
      'This usually means the page was loaded from an insecure (http://) origin. ' +
      'In Capacitor, set `server.androidScheme: "https"` in capacitor.config.ts.');
  }

  return kind;
}

export function isNativeWrapper(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.documentElement.getAttribute('data-native');
  return v === 'capacitor' || v === 'twa';
}
