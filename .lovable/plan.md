This is a large, multi-area request. Here's how I'll tackle it in one coordinated pass. Please confirm before I start — especially the rename, since it touches the database and stored values.

## 1. Rebrand: VibeTribe → VibTribe (everywhere)
- Replace every code/content occurrence: page titles, meta tags, manifest, OG tags, toasts, modals, push payloads, email subject, service worker, README-ish strings.
- Update the brand wordmark/logo text component.
- Update DB string values that contain "VibeTribe" (e.g. default notification titles, support email body templates if any) via migration. **Note:** the email domain `vibetribe.in` in `VAPID_SUBJECT` will be left as-is (it's a mailto identifier, changing it requires DNS); I'll flag this for you.
- I will NOT rename Supabase project ref / storage bucket names (would break uploads). Buckets stay `status-media`, `profile-photos`.

## 2. Status viewer
- **Hold-to-pause**: pointerdown pauses, pointerup resumes — independent of the play/pause button state.
- **Heart button** → posts a "❤️ Liked your status" reaction (chat message tagged as status-reaction) instead of opening reply composer. Reply stays via the bottom input bar.
- **Eye button** → directly opens the viewers list panel (remove the intermediate prompt).
- **Close (×) button**: fix tap target — currently swallowed by portal/backdrop. Wire `onPointerUp` with `stopPropagation` and ensure z-index above progress bar.

## 3. Admin panel
- **Online now**: add `last_seen_at` heartbeat (ping every 30s from AuthContext while tab visible). Admin query counts users with `last_seen_at > now() - 2 min`.
- **Username column**: show `username` in the users table.
- **Mandatory username at signup**: add required field on `SignUpPage` + `CompleteProfilePage`; uniqueness check.
- **Backfill**: one-time migration assigns `<full_name_slug><random4>` to existing users with NULL/empty username.

## 4. Chat window
- Show user's avatar (not initial) in the chat header; clicking opens a full-screen image viewer (reuse the status enlarge component).
- **Add-to-contacts banner**: if the other participant isn't in `contacts`, show a small inline banner above the message list with "Add to VibTribe contacts" button. Separate from phone-contact import (which stays in Contacts tab).

## 5. Calls
- **Remove permission modal**: call `getUserMedia` directly on click; browser's native prompt handles permission. Delete `PermissionPrompt` usage for call buttons.
- **Video-call falling back to audio**: fix `getUserMedia({ video: true, audio: true })` — currently re-uses an audio-only stream if mic was granted first. Always request fresh stream per call type.
- **Video freeze**: add ICE restart on connection-state `disconnected`, and ensure `addTrack` happens before `createOffer` (race fix).

## 6. Push notifications
- Service worker: ensure `showNotification` is called inside `event.waitUntil`.
- Trigger push from a server fn on every new message insert (currently only fires for some paths). Add a DB trigger → server fn webhook call.
- Subscribe on login (not just first visit) and re-subscribe if `pushManager.getSubscription()` is null.

## 7. Complete-profile stuck page (image 3)
- The "Saving… Redirecting…" hangs because the redirect waits on a profile refetch that never resolves when RLS rejects the just-updated row. Fix: navigate immediately after `update().select().single()` succeeds; don't await secondary fetches.

## 8. Session persistence (no auto-logout)
- Already `persistSession: true`. Add explicit refresh on visibility change and SW message. Increase JWT expiry isn't needed — the refresh-token flow handles it; just make sure `onAuthStateChange` doesn't sign out on transient `TOKEN_REFRESHED` errors (currently it does in one path).

## 9. Login speed
- Parallelize: kick off `signInWithPassword` and prefetch `user_profiles` row concurrently.
- Remove blocking `await` on `mark_messages_read` and push-subscribe (fire-and-forget).
- Lazy-load heavy chat bundle after navigation, not before.

## 10. PWA / cross-platform sync
- Add proper iOS safe-area-inset handling globally.
- Ensure manifest `display: standalone`, theme color, masked icons.
- Service worker: NetworkFirst for HTML, runtime cache for images.
- Add `Add to Home Screen` banner on Android (already exists for iOS-style? verify).

---

## What I will NOT change without your explicit OK
- Storage bucket names, Supabase project ref, env var names.
- The `vibetribe.in` mailto in VAPID_SUBJECT (needs your DNS change).
- The deployed domain `vibtribe.in` (already correct).
- User access/permissions/roles — only fixes, no privilege changes.

## Approval checkpoints I need from you
1. **Confirm rename scope**: replace "VibeTribe" → "VibTribe" in code + user-visible DB strings only (keeping bucket names, project ref, mailto domain). ✅/❌
2. **Username backfill format**: `firstname + 4 random digits` (e.g. `richa3829`). OK?
3. **Online-now threshold**: 2 minutes since last heartbeat = "online". OK?

Reply "go" with answers to the 3 questions (or "go, defaults" to accept) and I'll execute everything in one batched implementation.