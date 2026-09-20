# Phone Call Audio and Background Controls

## Goal

Make voice calls use the phone earpiece by default, make the speaker toggle reliable, and keep active Android calls available when the app is sent to the background.

## Changes

- Route voice-call audio through Android's communication audio mode and explicitly select the earpiece or built-in speaker on modern Android versions.
- Reapply the selected route when a call connects or returns from the background, so WebView audio cannot silently reset it.
- Keep the Android app task alive when the user leaves an active call, with the existing foreground call notification remaining visible.
- Make the notification's End action stop the call immediately and reliably reach the in-app call session when available.
- Keep video calls on speaker by default and restore normal media audio routing after calls end.

## Verification

- Check voice-call default routing and repeated earpiece/speaker toggles.
- Check backgrounding and returning to an active call.
- Check notification Mute and End actions and cleanup after ending.
- Run focused web and Android checks.

## Technical notes

A foreground notification can preserve an Android app call while it is backgrounded or removed from the recent-apps screen. Android Force stop and iPhone PWA termination cannot preserve a browser-based WebRTC call; the operating system explicitly stops those processes.
