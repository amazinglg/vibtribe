# Implementation plan

## 1. Download counter tile (Admin overview)

**Schema (migration):**
- New table `apk_download_events(id, ip_hash, user_agent, created_at)`.
- GRANT INSERT to `anon` + `authenticated`; SELECT only to admins via RLS using `is_admin_user()`.

**Server route:** `src/routes/api/public/track-apk-download.ts` — POST endpoint, inserts one row per click (rate-limited by IP hash within 60s using a UNIQUE partial index isn't necessary; simple insert is fine).

**Frontend:**
- `src/routes/download.android.tsx`: call the tracking endpoint inside `startDownload()`.
- `src/pages/AdminPage.tsx`: add a "Downloads" tile next to "Online now" showing total APK clicks (count(*)).

## 2. Chat long-press menu — fix overflow, add Block & Mute

**Schema:**
- New table `chat_mutes(user_id, chat_id, muted_until timestamptz null, created_at)` — `null` = mute forever. RLS: users manage own.

**Logic:**
- `src/pages/components/ChatListPanel.tsx`:
  - Replace fixed-position dropdown with a positioning helper: measure long-pressed row bbox + viewport, render menu **above** if `bottom > viewport.height - 220px`, else below. Clamp to safe-area (bottom-nav height ~80px).
  - Add **Block user** (calls existing block flow) and **Mute** (opens timeline picker: 1h / 24h / 1w / Always).
  - For VibTribe official chat: only show Block + Mute.
- Notifications: filter outgoing FCM + in-app toasts + unread badge by joining `chat_mutes` where `muted_until is null OR muted_until > now()`. Adjust:
  - `src/lib/fcm-push.functions.ts` (skip push when muted)
  - `ChatListPanel` unread count query (exclude muted chats from badge)
  - Toast layer in `CallProvider`/notification listener.

## 3. Permission toggle persistence fix

**Symptom:** Mic/Camera **toggle** flips back to off even when OS permission stays granted.

**Root cause (to verify when reading):** `PermissionsPage` likely re-reads OS permission state on focus and overwrites the user's stored preference. The toggle should reflect a *stored user choice* AND only show enabled when OS permission is granted; OS state changes shouldn't silently reset the user toggle.

**Fix:**
- Persist toggle state in `user_profiles` (already have `notif_*` columns — add `pref_mic_enabled`, `pref_camera_enabled` via migration).
- `PermissionsPage.tsx` reads from DB on mount, writes on change. OS permission read only gates the *Request access* button, never overwrites stored value.
- Apply same pattern to all other on/off toggles in Permissions/Profile that exhibit drift.

## 4. Website: download banner + improved iOS PWA guide

- `LandingPage.tsx`: add a sticky top "Download VibTribe App" CTA below the "I already have an account" button, theme-matched. Add a dismissible promo banner near top that smooth-scrolls to `#download` section.
- New route `src/routes/download.ios.tsx`: stepper mirroring Android (Safari → Share → Add to Home Screen → permissions → first launch) with screenshots/illustrations.
- Update LandingPage iOS button to link to `/download/ios`.

## 5. Status: 24h hard-delete + non-encrypted banner + legal updates

**Cleanup:**
- Server route `src/routes/api/public/hooks/cleanup-expired-statuses.ts`: deletes storage files for expired statuses, then deletes the rows.
- `pg_cron` every 15 min → calls the route.

**UI banner:**
- `StatusHero.tsx` (status composer): below "Visibility: All" selector, add an amber info banner: *"Statuses are not end-to-end encrypted. Media is auto-deleted from our servers 24 hours after posting."*

**Legal:**
- Update `src/components/legal/LegalContent.tsx` — add a "Status feature" subsection covering non-encryption + 24h retention.

**Security finding:** mark `status-media public bucket` as ignored with rationale; update security memory.

## 6. Capacitor sync to Android + iOS PWA

- Run `npx cap sync` to push web build changes into `android/`.
- PWA is the web app itself — no extra build step; iOS gets changes the next time user reloads from Home Screen.
- Bump `versionCode`/`versionName` in `android/app/build.gradle` so the next signed APK reflects the changes.

## Technical notes

- All new tables: GRANT block + RLS per project standards.
- Cron secret: use `apikey` anon header pattern per `schedule-jobs-modern`.
- No edits to `src/integrations/supabase/*` or `src/routeTree.gen.ts` (auto-generated).

## Files touched (estimate)

New: 4 (track-apk-download route, cleanup-expired-statuses route, download.ios.tsx, migration)
Edited: ~12 (AdminPage, ChatListPanel, PermissionsPage, LandingPage, StatusHero, LegalContent, fcm-push.functions, download.android.tsx, build.gradle, security memory, +2)

Reply **"go"** to execute, or tell me what to adjust.
