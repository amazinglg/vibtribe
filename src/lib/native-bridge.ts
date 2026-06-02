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

  // --- StatusBar setup (Capacitor only) ---
  // Configure the native status bar to overlay the WebView so that
  // `env(safe-area-inset-top)` resolves to the actual inset and the page
  // can pad itself once. Without this the WebView is laid out below the
  // status bar AND the CSS adds its own padding → double gap.
  if (kind === 'capacitor') {
    // Dynamic import keeps the plugin out of the browser bundle.
    import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      })
      .catch(() => {});
  }

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

/**
 * Request native camera permission via the Capacitor Camera plugin.
 * In a browser this returns 'prompt' — the caller should fall back to
 * `navigator.mediaDevices.getUserMedia({ video: true })`.
 */
export async function requestNativeCameraPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativeWrapper()) return 'prompt';
  try {
    const { Camera } = await import('@capacitor/camera');
    const res = await Camera.requestPermissions({ permissions: ['camera'] });
    return res.camera === 'granted' ? 'granted' : 'denied';
  } catch (e) {
    console.error('[VibTribe] Camera.requestPermissions failed', e);
    return 'denied';
  }
}

/**
 * Request native contacts permission via the community Contacts plugin.
 * No-op in browser (web platform has no contacts API).
 */
export async function requestNativeContactsPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativeWrapper()) return 'prompt';
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const res = await Contacts.requestPermissions();
    // Plugin returns { contacts: 'granted' | 'denied' }
    const status = (res as { contacts?: string }).contacts;
    return status === 'granted' ? 'granted' : 'denied';
  } catch (e) {
    console.error('[VibTribe] Contacts.requestPermissions failed', e);
    return 'denied';
  }
}
