# VibTribe — Native Android Build (Play Store)

Your PWA at https://www.vibtribe.in is ready to be wrapped as a Trusted Web Activity (TWA) using Bubblewrap and submitted to Google Play.

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

## 8. iOS (optional, later)
TWA is Android-only. For iOS submission use **PWABuilder** (https://www.pwabuilder.com/) → Package for iOS, which produces an Xcode project wrapping the same PWA.