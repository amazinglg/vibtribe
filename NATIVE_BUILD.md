# VibTribe — Native Android Build (Play Store)

## Capacitor wrapper — required manual steps after pulling

The web project now ships full Capacitor support (push, deep links, back
button, keyboard, splash, audio routing, wake-lock, image picker, network).
After pulling, run these once inside the wrapper repo:

1. **Install pods/plugins** — `npm install && npx cap sync android`
2. **FCM push notifications** — Required for native push to work:
   - Create (or reuse) a Firebase project, add an Android app with package
     id `app.vibtribe.app`, and download `google-services.json`.
   - Drop the file at `android/app/google-services.json`.
   - In `android/build.gradle` add `classpath 'com.google.gms:google-services:4.4.2'`
     to `buildscript.dependencies`.
   - In `android/app/build.gradle` add `apply plugin: 'com.google.gms.google-services'`
     at the bottom.
   - Push tokens are written automatically to the new `public.fcm_tokens`
     Supabase table after each user logs in.
3. **Deep links** — Replace the `REPLACE_WITH_YOUR_CAPACITOR_APK_SHA256_FINGERPRINT`
   line in `public/.well-known/assetlinks.json` with the SHA-256 fingerprint
   of the signing key you ship to Play Store
   (`keytool -list -v -keystore release.keystore`).
4. **Build** — `cd android && ./gradlew assembleDebug`


Your PWA at https://www.vibtribe.in is ready to be wrapped as a Trusted Web Activity (TWA) using Bubblewrap and submitted to Google Play.

> ⚠️ **Architecture note.** VibTribe is a server-rendered TanStack Start app
> on Cloudflare Workers. Capacitor's default model (bundle a static SPA into
> the APK and load it from `capacitor://localhost`) is **not** compatible
> with this stack — there is no static `dist/` to ship. The two supported
> Android paths are:
>
> 1. **TWA via Bubblewrap (recommended, documented below).** The APK opens
>    the live `https://www.vibtribe.in` site in Chrome Custom Tabs. Best
>    integration with Web APIs, WebCrypto, IndexedDB, push, and Supabase
>    auth.
> 2. **Capacitor with remote URL.** A separate Capacitor wrapper project
>    whose `capacitor.config.ts` sets `server.url = "https://www.vibtribe.in"`
>    and `server.androidScheme = "https"`. Treat the wrapper as its own repo;
>    only the safe-area, status-bar, and plugin guidance below applies to
>    the wrapper, not to this codebase.

## 1. Install Bubblewrap
```bash
npm i -g @bubblewrap/cli
bubblewrap doctor
```

## 2. Initialize the project
```bash
bubblewrap init --manifest=https://www.vibtribe.in/manifest.json
```
When prompted, accept these values:
- Application name: **VibTribe**
- Short name: **VibTribe**
- Package name: **app.vibtribe.twa**
- Host: **www.vibtribe.in**
- Start URL: **/**
- Display mode: **standalone**
- Status bar color: **#0a0a0f**
- Splash color: **#0a0a0f**
- Orientation: **portrait**
- Notification delegation: **yes** (for push)
- Include screen overlay (location/notification): **no**

## 3. Build the signed bundle
```bash
bubblewrap build
```
Outputs `app-release-bundle.aab` (upload this to Play Console) and `app-release-signed.apk` (for local install testing).

## 4. Digital Asset Links (CRITICAL)
Without this, the TWA shows the Chrome URL bar instead of running fullscreen.

1. In Play Console → **Setup → App signing**, copy the **SHA-256 certificate fingerprint**.
2. Edit `public/.well-known/assetlinks.json` and replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` with that value (keep the colons, uppercase).
3. Publish/redeploy so `https://www.vibtribe.in/.well-known/assetlinks.json` returns the new content.
4. Verify: `curl https://www.vibtribe.in/.well-known/assetlinks.json`

## 5. Play Console listing
- Category: **Communication** / **Social**
- Content rating: complete the IARC questionnaire (messaging + user-generated content)
- Data safety: declare — Account info, Contacts (optional), Messages, Photos, Audio, Location (if used), Device IDs
- Privacy policy URL: required (host at `/privacy` on www.vibtribe.in)
- Target SDK: Bubblewrap sets this automatically to the current Play requirement

## 6. Push notifications
Already wired via web-push + VAPID. TWA delegates notification permission to the installed app automatically (Bubblewrap option enabled in step 2). No FCM key needed for delivery — the existing `send-push-notification` edge function continues to work.

## 7. What's already done in the code
- ✅ `manifest.json` with id, scope, start_url, standalone, theme/background color, maskable icons, shortcuts
- ✅ `prefer_related_applications: false` (Play Store will not redirect TWA → native app)
- ✅ Service worker (`/sw.js`) — NetworkFirst HTML, SWR images, push + notificationclick handlers
- ✅ Safe-area insets via `viewport-fit=cover` and `env(safe-area-inset-*)` in layout
- ✅ `apple-mobile-web-app-*` meta tags (for iOS sideload via Safari)
- ✅ Persistent Supabase session (`persistSession: true`) — users stay logged in across app restarts
- ✅ Visibility-based token refresh — no surprise logouts when Android suspends the app
- ✅ `.well-known/assetlinks.json` scaffold ready to fill in
- ✅ `--safe-top` / `--safe-bottom` CSS variables with a 28px / 16px floor
      so content never slides under the Android status bar or gesture-nav
      pill — even when the WebView returns 0 for `env(safe-area-inset-*)`
- ✅ Native wrapper detection (`src/lib/native-bridge.ts`) tags
      `<html data-native="capacitor|twa">` so CSS opts into stronger insets
- ✅ WebCrypto / IndexedDB availability check in `src/lib/encryption.ts` —
      surfaces a clear error if the WebView loaded over http:// instead of
      throwing a cryptic "Incorrect PIN" message

## 9. Capacitor wrapper checklist (if you use option 2)

These settings live in **your separate Capacitor project**, not in this repo.

```ts
// capacitor.config.ts (in the wrapper repo)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.vibtribe.app',
  appName: 'VibTribe',
  webDir: 'www',           // any placeholder; we override with server.url below
  server: {
    url: 'https://www.vibtribe.in',
    androidScheme: 'https', // REQUIRED — WebCrypto & secure cookies need https
    cleartext: false,
    allowNavigation: ['*.vibtribe.in', '*.supabase.co', '*.lovable.app'],
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: { style: 'DARK', backgroundColor: '#070a1b', overlaysWebView: false },
    SplashScreen: { backgroundColor: '#070a1b', launchAutoHide: true },
  },
};
export default config;
```

Install the plugins the web app expects:

```bash
npm i @capacitor/core @capacitor/android \
      @capacitor/status-bar @capacitor/app \
      @capacitor/preferences @capacitor/push-notifications \
      @capacitor-community/safe-area
```

In the wrapper's `MainActivity.java` (or in a small TS bootstrap that runs
before the WebView loads the remote URL), call:

```ts
import { StatusBar, Style } from '@capacitor/status-bar';
import { SafeArea } from '@capacitor-community/safe-area';

await SafeArea.enable({
  config: { customColorsForSystemBars: true, statusBarColor: '#00000000', navigationBarColor: '#00000000' },
});
await StatusBar.setStyle({ style: Style.Dark });
await StatusBar.setBackgroundColor({ color: '#070a1b' });
await StatusBar.setOverlaysWebView({ overlay: false });
```

**Why this matters for VibTribe specifically:**
- `androidScheme: 'https'` keeps `crypto.subtle` defined → E2E PIN works.
- Remote `server.url` keeps the WebView origin = `vibtribe.in`, so the
  Supabase auth session, IndexedDB key cache, and Service Worker registered
  by the live site continue to work after app restarts.
- `SafeArea.enable({...})` populates `env(safe-area-inset-*)`. The web
  app's `--safe-top` / `--safe-bottom` variables (with the 28px / 16px
  floor we ship) handle the rest.
- `overlaysWebView: false` keeps the status bar opaque so content can't
  slide under the camera cutout even if a safe-area plugin call fails.

## 10. Known PWA → Capacitor differences (still web-only by design)

These web APIs do **not** have first-class equivalents inside the WebView.
The app degrades gracefully but won't be 100% identical:

- **Web Push** (`PushSubscription` / VAPID) does not work in a plain
  Capacitor WebView. Use `@capacitor/push-notifications` + FCM in the
  wrapper and forward tokens to the same `push_subscriptions` table.
  TWA already delegates notification permission to the OS, so push
  continues to work there with no changes.
- **`getUserMedia` for video/voice calls** works in both, but on some
  Android OEM WebViews you must add `<uses-permission android:name="android.permission.RECORD_AUDIO" />`
  and `CAMERA` to the wrapper's `AndroidManifest.xml`, and implement
  `onPermissionRequest()` in the WebChromeClient to grant the WebView
  access.
- **Service Worker caching** runs inside the WebView for both TWA and
  Capacitor-with-remote-URL. For fully-bundled Capacitor (option 1 of the
  un-recommended path) the SW is disabled entirely; you'd need to swap in
  `@capacitor/preferences` for offline storage.

## 8. iOS (optional, later)
TWA is Android-only. For iOS submission use **PWABuilder** (https://www.pwabuilder.com/) → Package for iOS, which produces an Xcode project wrapping the same PWA.