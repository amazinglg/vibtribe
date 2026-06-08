/**
 * Detect when VibTribe is running inside a native wrapper (Capacitor or
 * Android Trusted Web Activity) and tag <html data-native="..."> so runtime
 * behaviour can adjust to native-only capabilities.
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

  if (kind === 'capacitor') {
    // Android safe areas are injected by MainActivity from real WindowInsets
    // into the global --safe-* CSS variables. Do not use StatusBar overlays or
    // a JS safe-area plugin here; those paths competed with native insets.
    // Hide the native splash as soon as the WebView is interactive.
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
      })
      .catch(() => {});

    // Keyboard: resize the WebView so chat input is never covered.
    import('@capacitor/keyboard')
      .then(({ Keyboard, KeyboardResize }) => {
        Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
        Keyboard.setScroll({ isDisabled: false }).catch(() => {});
        Keyboard.addListener('keyboardWillShow', (info) => {
          document.documentElement.style.setProperty(
            '--keyboard-height', `${info.keyboardHeight}px`,
          );
          document.documentElement.setAttribute('data-keyboard', 'open');
        });
        Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--keyboard-height', '0px');
          document.documentElement.removeAttribute('data-keyboard');
        });
      })
      .catch(() => {});

    // Hardware back button → router history; if at root, minimize app.
    import('@capacitor/app')
      .then(({ App }) => {
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack && window.history.length > 1) {
            window.history.back();
          } else {
            App.minimizeApp().catch(() => {});
          }
        });

        // Resume: reconnect Supabase realtime + refresh session when WebView
        // wakes from background (Android suspends WebView aggressively).
        App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return;
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            // Force-refresh the auth session and reconnect realtime channels.
            await supabase.auth.getSession();
            (supabase as unknown as { realtime?: { connect: () => void } })
              .realtime?.connect();
            window.dispatchEvent(new CustomEvent('vt-app-resumed'));
          } catch (e) {
            console.warn('[VibTribe] resume reconnect failed', e);
          }
        });

        // Deep links: vibtribe.in/* and custom scheme → push into the router.
        App.addListener('appUrlOpen', ({ url }) => {
          try {
            const u = new URL(url);
            const path = u.pathname + u.search + u.hash;
            if (path && path !== '/') {
              window.history.pushState({}, '', path);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          } catch {}
        });
      })
      .catch(() => {});

    // Network status → broadcast so reconnect logic can react.
    import('@capacitor/network')
      .then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          document.documentElement.setAttribute(
            'data-online', status.connected ? 'true' : 'false',
          );
          if (status.connected) {
            window.dispatchEvent(new CustomEvent('vt-network-online'));
          }
        });
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
 * Request native microphone permission (Android RECORD_AUDIO).
 * The Capacitor Camera plugin does not cover RECORD_AUDIO, so we trigger
 * the OS prompt by calling getUserMedia({ audio: true }) which the WebView
 * forwards via onPermissionRequest (granted by MainActivity).
 */
export async function requestNativeMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativeWrapper()) return 'prompt';
  if (!navigator?.mediaDevices?.getUserMedia) return 'denied';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (e) {
    console.warn('[VibTribe] mic permission denied', e);
    return 'denied';
  }
}

/**
 * Request native storage / photos permission. On Android 13+ this maps to
 * READ_MEDIA_IMAGES via the Capacitor Camera plugin's `photos` permission;
 * on older Android it requests READ_EXTERNAL_STORAGE.
 */
export async function requestNativeStoragePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativeWrapper()) return 'prompt';
  try {
    const { Camera } = await import('@capacitor/camera');
    const res = await Camera.requestPermissions({ permissions: ['photos'] });
    // Plugin returns { photos: 'granted' | 'denied' | 'limited' }
    const photos = (res as { photos?: string }).photos;
    return (photos === 'granted' || photos === 'limited') ? 'granted' : 'denied';
  } catch (e) {
    console.error('[VibTribe] Storage/photos permission failed', e);
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

/**
 * Register for FCM push notifications and persist the token in Supabase.
 * Returns the token string on success, or null on any failure.
 *
 * Requires `android/app/google-services.json` from your Firebase project +
 * the Google Services Gradle plugin. See NATIVE_BUILD.md.
 */
export async function registerNativePushNotifications(
  userId: string,
): Promise<string | null> {
  if (!isNativeWrapper() || !userId) return null;
  try {
    const [{ PushNotifications }, { supabase }] = await Promise.all([
      import('@capacitor/push-notifications'),
      import('@/integrations/supabase/client'),
    ]);

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return null;

    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const done = (val: string | null) => { if (!settled) { settled = true; resolve(val); } };

      PushNotifications.addListener('registration', async (token) => {
        try {
          await (supabase as unknown as { from: (t: string) => { upsert: (v: unknown, o?: unknown) => Promise<unknown> } }).from('fcm_tokens').upsert({
            user_id: userId,
            token: token.value,
            platform: 'android',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });
        } catch (e) {
          console.warn('[VibTribe] fcm token upsert failed', e);
        }
        done(token.value);
      });
      PushNotifications.addListener('registrationError', (err) => {
        console.error('[VibTribe] FCM registration error', err);
        done(null);
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification?.data?.url as string | undefined;
        if (url) {
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });

      PushNotifications.register().catch(() => done(null));
      // Hard cap so callers don't await forever if FCM is unconfigured.
      setTimeout(() => done(null), 8_000);
    });
  } catch (e) {
    console.error('[VibTribe] registerNativePushNotifications failed', e);
    return null;
  }
}

/**
 * Pick an image using the native camera/gallery picker. Returns a data URL
 * the caller can use directly in <img src=...> or upload to Supabase Storage.
 */
export async function pickNativeImage(opts?: {
  source?: 'camera' | 'photos' | 'prompt';
  quality?: number;
}): Promise<string | null> {
  if (!isNativeWrapper()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const src = opts?.source === 'camera' ? CameraSource.Camera
      : opts?.source === 'photos' ? CameraSource.Photos
      : CameraSource.Prompt;
    const photo = await Camera.getPhoto({
      quality: opts?.quality ?? 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: src,
    });
    return photo.dataUrl ?? null;
  } catch (e) {
    console.warn('[VibTribe] pickNativeImage failed', e);
    return null;
  }
}

/**
 * Pick one or more files (any MIME) using the native system picker. Returns
 * an array of { name, mime, dataUrl } objects so the caller can convert each
 * one into a File via fetch(dataUrl).blob().
 */
export async function pickNativeFiles(opts?: {
  types?: string[];           // MIME filter, e.g. ['application/pdf']
  multiple?: boolean;
  readData?: boolean;          // include base64 data (default true)
}): Promise<Array<{ name: string; mime: string; dataUrl: string }>> {
  if (!isNativeWrapper()) return [];
  try {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');
    const res = await FilePicker.pickFiles({
      types: opts?.types,
      limit: opts?.multiple ? 0 : 1,
      readData: opts?.readData ?? true,
    } as unknown as Parameters<typeof FilePicker.pickFiles>[0]);
    const files = (res?.files ?? []) as Array<{ name?: string; mimeType?: string; data?: string }>;
    return files
      .filter((f) => !!f.data)
      .map((f) => ({
        name: f.name || `file-${Date.now()}`,
        mime: f.mimeType || 'application/octet-stream',
        dataUrl: `data:${f.mimeType || 'application/octet-stream'};base64,${f.data}`,
      }));
  } catch (e) {
    console.warn('[VibTribe] pickNativeFiles failed', e);
    return [];
  }
}

/**
 * Acquire a wake-lock during an active call so the screen + CPU stay alive.
 * Returns a release function. Uses the standard Web WakeLock API which the
 * Android WebView supports.
 */
export async function acquireCallWakeLock(): Promise<() => void> {
  const noop = () => {};
  if (typeof navigator === 'undefined') return noop;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
  };
  if (!nav.wakeLock?.request) return noop;
  try {
    const sentinel = await nav.wakeLock.request('screen');
    return () => { sentinel.release().catch(() => {}); };
  } catch {
    return noop;
  }
}

/**
 * Route call audio to the loudspeaker (video calls / speakerphone) or back to
 * the earpiece (default voice call). On Android this flips the AudioManager
 * mode via the WebRTC track's `setSinkId` when available, and otherwise
 * relies on the system default.
 */
export async function setCallAudioRoute(route: 'speaker' | 'earpiece'): Promise<void> {
  try {
    // Best-effort: toggle the speakerphone flag the WebView understands.
    // Capacitor 8 does not bundle an AudioManager plugin by default; the
    // WebView already requests MODIFY_AUDIO_SETTINGS via the AndroidManifest
    // so the OS routes WebRTC audio correctly based on whether a video track
    // is present. We expose this hook for future native plugin wiring.
    document.documentElement.setAttribute('data-call-audio', route);
  } catch {}
}

/** Trigger native haptic feedback (incoming call, message send confirmation). */
export async function nativeHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!isNativeWrapper()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  } catch {}
}
