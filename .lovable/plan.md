# Audio and Video Call Upgrade

## Goal

Make calls clearer, more reliable, and easier to control across web, PWA, and Android without replacing the existing calling protocol.

## Experience

- Apply the selected Midnight Amethyst palette with Sora headings, Manrope body text, and a compact-console layout.
- Give voice and video calls a stable bottom control dock, clear labels, large touch targets, safe-area spacing, and visible active states.
- Show useful states for ringing, connecting, reconnecting, weak/offline connections, microphone recovery, and ended calls.
- Improve incoming-call presentation with caller photo support, call type, and polished accept/decline controls.
- Keep minimize, camera swap, speaker/earpiece, mute, camera, and end-call actions accessible without covering video.

## Reliability

- Make signaling resilient to messages arriving before subscriptions or remote descriptions are ready.
- Queue early network candidates, prevent duplicate timers/listeners, and make cleanup safe to run more than once.
- Add bounded reconnection with visible status and timeout handling instead of silently hanging.
- Restore media and live connection state after app resume or network return, while preserving the existing iOS microphone recovery.
- Ensure permission denial and unavailable-device errors leave no camera, microphone, ringtone, notification, or wake-lock resources active.

## Android

- Upgrade the lock-screen incoming-call screen to match the web call UI and display caller photos safely.
- Correctly manage ringtone, audio focus/routing, notifications, and foreground-call lifecycle.
- Preserve current deep-link behavior and verify accept, decline, mute, return-to-call, and end actions.

## Security safeguards

- Prevent public-tribe joins from assigning a leader role.
- Prevent direct-chat participants from changing either participant identity while retaining legitimate metadata updates.

## Verification

- Run focused checks for call state transitions, cleanup, and signaling helpers.
- Exercise voice/video layouts at phone and desktop sizes, including light themes and safe areas.
- Validate Android code paths and confirm no existing chat, notification, or Trust Lock behavior regresses.

## Technical notes

- Keep the existing WebRTC and database call model; this is an incremental hardening, not a provider migration.
- Break the oversized call screen into focused internal controls and state helpers only where it lowers regression risk.
- Native Android improvements require a new app build; web/PWA improvements become available with the website release.
