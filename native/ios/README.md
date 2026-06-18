# VibTribe — iOS Trust Lock plugin install

VibTribe ships the iOS half of the cross-platform Trust Lock feature as a
local Capacitor plugin. There is no separate npm package — the two files in
this folder are dropped straight into the iOS wrapper project.

## One-time setup

Run these steps once inside your Capacitor iOS wrapper repo (the project that
wraps `https://www.vibtribe.in`). They mirror the Android steps in the
top-level `NATIVE_BUILD.md`.

1. **Add the iOS platform** (if not already):
   ```bash
   npm install && npx cap add ios && npx cap sync ios
   ```

2. **Copy the plugin files** into the iOS app target:
   ```bash
   mkdir -p ios/App/App/Plugins/TrustLock
   cp native/ios/TrustLockPlugin.swift ios/App/App/Plugins/TrustLock/
   cp native/ios/TrustLockPlugin.m    ios/App/App/Plugins/TrustLock/
   ```

3. **Add the files to the Xcode target** — open `ios/App/App.xcworkspace`,
   right-click the `App` group → *Add Files to "App"…*, select the two files
   from `ios/App/App/Plugins/TrustLock/`, and ensure the **App** target is
   checked. If Xcode asks to create a bridging header, accept — Capacitor
   already ships one (`App-Bridging-Header.h`), so just confirm it exists.

4. **Rebuild**:
   ```bash
   npx cap sync ios && npx cap open ios
   ```
   Build & run from Xcode.

## What the plugin does

- Registers under the Capacitor plugin name **`VtTrustLock`**, matching the
  JS interface used by the Android `addJavascriptInterface` bridge so the
  web layer (`src/lib/trust-lock-service.ts`) talks to both platforms
  identically.
- Detects screenshots via `UIApplication.userDidTakeScreenshotNotification`
  and emits a `screenshotTaken` event the chat consumes to post a
  "🛡️ Screenshot detected on this device" system message.
- Detects screen recording via `UIScreen.capturedDidChangeNotification`,
  emits `screenRecordingChanged`, and paints a full-window `UIBlurEffect`
  overlay so the recording captures only the blur.
- Obscures the app-switcher snapshot by adding the same blur on
  `willResignActive` and removing it on `didBecomeActive` (unless screen
  recording is still active).

## Capabilities Apple does NOT allow

- **Blocking screenshots.** Apple does not expose a `FLAG_SECURE` equivalent
  to third-party apps. We can only DETECT them — never prevent them. The
  in-app system event ("Screenshot detected on this device") is the
  strongest user-visible signal allowed.
- **Blocking screen recording.** Same restriction. We obscure content
  proactively (UIBlurEffect overlay while `UIScreen.main.isCaptured` is
  true) instead.

These limitations are intentional and apply to every iOS chat app
(including WhatsApp, Signal, Telegram).