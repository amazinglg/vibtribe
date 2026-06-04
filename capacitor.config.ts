import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vibtribe.app',
  appName: 'VibTribe',
  webDir: 'dist',
  // IMPORTANT: VibTribe is a server-rendered TanStack Start app on Cloudflare
  // Workers — there is no static `dist/` to ship inside the APK. The Android
  // wrapper therefore loads the live PWA over HTTPS. This is what makes the
  // Android build behave identically to the PWA:
  //
  //   1. WebCrypto (`crypto.subtle`) requires a **secure context**. Loading
  //      from `http://…` leaves `crypto.subtle` undefined, which is why the
  //      E2E unlock failed with "Incorrect PIN" on Android — PBKDF2 simply
  //      threw before any compare could happen.
  //   2. Storage (IndexedDB, localStorage, cookies, Service Worker cache) is
  //      keyed by origin. Pointing the WebView at the same `vibtribe.in`
  //      origin as the PWA means the user's Supabase session, encrypted
  //      private-key cache, and message store are shared.
  //   3. `androidScheme: 'https'` keeps the bridge URL on https too, so
  //      mixed-content rules never strip WebCrypto / Service Worker.
  server: {
    url: 'https://www.vibtribe.in',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'www.vibtribe.in',
      'vibtribe.in',
      '*.vibtribe.in',
      '*.supabase.co',
      '*.lovable.app',
    ],
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      // The @capacitor-community/safe-area plugin owns Android WindowInsets.
      // Disable Capacitor's competing SystemBars inset handling so there is
      // exactly one native safe-area authority.
      insetsHandling: 'disable',
    },
    SafeArea: {
      statusBarStyle: 'DARK',
      navigationBarStyle: 'DARK',
      initialViewportFitCover: true,
      detectViewportFitCoverChanges: true,
    },
    SplashScreen: {
      backgroundColor: '#070a1b',
      launchAutoHide: false,
      launchShowDuration: 2500,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'native',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;