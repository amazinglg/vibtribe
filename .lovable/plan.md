# Premium Media Experience Overhaul

Big surface-area change across chats. I'll ship it in three focused waves so nothing regresses, and I need one decision from you on the outstanding security finding before I start.

---

## Wave 1 — Download & Share (functional fixes)

**New shared utility `src/lib/media-actions.ts`**
- `downloadMedia(url, filename, mime)` — resolves signed URL, then:
  - Capacitor / Android → `Filesystem.writeFile` into `Directory.Documents` (docs) or the public gallery via `MediaStore` intent for images/videos; falls back to `Filesystem.Documents` if unavailable.
  - PWA / Desktop → `showSaveFilePicker` when available, else anchor + `download` attribute blob download.
  - Emits progress events so the button can render the circular progress ring.
- `shareMedia({ url, filename, mime, text })`:
  - Capacitor → `@capacitor/share` (`Share.share` with `files:[]`).
  - Web → `navigator.share({ files })` when `navigator.canShare` allows; else `navigator.share({ url })`; else copy link + toast.
  - Trust Lock ON → throws `TrustLockError`; caller shows premium dialog.

**UI**
- Replace inline download icon in `ChatWindowPanel.tsx` and `EncryptedMedia.tsx` with new `<MediaActionButton>` (idle → progress ring → check → auto-reset). Purple glow, spring bounce, toast on completion/failure.
- Share button always visible when Trust Lock OFF; when ON, opens `<TrustLockBlockedDialog>` (shield icon, purple accent, framer-motion entrance).
- Wire same helpers into media viewer toolbar and status viewer.

**Platform capabilities**
- Android: add `WRITE_EXTERNAL_STORAGE` (≤API 28) + scoped `MediaStore` fallback via a small Capacitor plugin method in existing `VtTrustLockPlugin` file (new sibling `VtMediaSaverPlugin.java`) so images/videos land in the gallery.
- Add `@capacitor/share` and `@capacitor/filesystem` (already partly present — will confirm).

---

## Wave 2 — Reactions & Long-Press Menu

**Reaction picker `src/components/ReactionPicker.tsx`**
- Glass capsule (`backdrop-blur-xl bg-white/10 border border-white/15`), spring entrance (scale 0.9→1, y 8→0), 60 fps framer-motion.
- Emojis: hover scale 1.15, tap bounce, selection triggers scale + glow + 6-particle burst (pure CSS keyframes, GPU only).
- Existing reactions fade+scale in when message mounts.
- Removing own reaction: shrink + fade before state update (150ms) — no instant pop.

**Long-press bottom sheet `src/components/MediaActionSheet.tsx`**
- Radix `Drawer` (vaul) with rounded top corners, glass background, safe-area padding.
- Options staggered in (40ms each): Reply, React, Forward, Copy, Download, Share, Save to Vault, Report, Delete.
- Reused by messages, images, videos, audio, docs, status viewer, profile header, tribe header.

---

## Wave 3 — Media Viewer & Micro-interactions

- `src/components/MediaViewer.tsx` upgrade: shared-element style opening (thumbnail rect → full-screen via framer-motion `layoutId`), backdrop blur ramp, toolbar fades in 120ms after transform completes; reverse on close (swipe-down to dismiss).
- Icon button primitive `IconAction` — hover scale, focus ring, ripple, optional haptic (`Haptics.impact`), `prefers-reduced-motion` respected everywhere.
- Accessibility: aria-labels on every icon-only button, focus trap in sheet/viewer, keyboard shortcuts (Esc close, ←/→ nav, R react), screen-reader live region for download progress.

---

## QA checklist I'll run before handoff

- Playwright: download an image + doc in PWA, verify file lands via `page.on('download')`.
- Manual verification steps documented for Android build (needs your APK rebuild — I'll flag it).
- Trust Lock ON path: share/download buttons hidden or blocked with dialog.
- Reduced-motion: animations collapse to opacity-only.
- Console/network clean during a full chat session.

---

## Outstanding security finding — I need your call to proceed

`profile_photos_public_bucket_bypass` is still open. It's high-risk because it touches every avatar surface. Pick one and I'll fold it into Wave 1:

- **A. Full fix** — flip `profile-photos` bucket to private, upgrade `visible_avatar_urls` RPC to return signed URLs, migrate every `<img>` avatar site to a `<Avatar userId=…>` helper. Correct but touches ~20 files.
- **B. Partial** — restrict SELECT policy to authenticated only. Won't clear the finding (public bucket bypasses RLS for direct URLs) but blocks anonymous listing.
- **C. Skip** — leave the finding open for now; I'll come back to it.

Reply **A**, **B**, or **C** (plus "go" to start the media work).
