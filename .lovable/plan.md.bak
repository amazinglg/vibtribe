# Offline-First Encrypted Message Cache

Goal: chats open instantly (no skeletons after first visit), sync happens silently in the background, and nothing readable ever touches local storage.

## Current state

- The chat list already caches into `sessionStorage` (plaintext JSON) and only shows a skeleton on true first load.
- A conversation itself always refetches from the network before rendering — this is where the skeleton and the slow open come from.
- Media is fetched fresh via short-lived signed URLs on every open.

## Proposed architecture

```text
UI (React)                 in-memory decrypted store (per session)
   |  instant read                  ^
   v                                | decrypt on read
Cache layer  ---->  IndexedDB (encrypted blobs only)
   |                                ^
   |  cursor-based delta            | merge
   v                                |
Sync engine  <---->  backend (messages, chats)  <---> realtime channel
   |
Outbox (queued sends, retried on reconnect)
```

Four new modules under `src/lib/offline/`:

1. `cache-db.ts` — IndexedDB wrapper. Stores: `chats`, `messages`, `outbox`, `media`, `meta`. Every record's payload is a single AES-256-GCM ciphertext blob; only routing fields (`chat_id`, `id`, `created_at`, `sync_state`) stay in the clear so we can index and paginate without decrypting.
2. `cache-crypto.ts` — key management + encrypt/decrypt helpers.
3. `sync-engine.ts` — delta pull, merge, conflict resolution, outbox flush.
4. `use-cached-chat.ts` / `use-cached-chats.ts` — hooks the panels consume: return cached data synchronously on mount, then update in place.

## Encryption approach

- One random 256-bit **Cache Master Key (CMK)** per device per user, generated on first unlock.
- The CMK is stored **wrapped**, never raw:
  - Android: wrapped by a hardware Keystore key (`AES/GCM`, `setUserAuthenticationRequired(false)`, `StrongBox` when available) through a new `VtSecureStore` Capacitor plugin.
  - iOS (native shell): Keychain item with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
  - Web / iOS PWA (no Keychain): CMK is derived from the existing 6-digit encryption PIN via PBKDF2 and held only as a non-extractable `CryptoKey` in memory + an IndexedDB-stored `CryptoKey` handle (browsers keep the key material opaque). If the user has no PIN set, caching stays off rather than degrading to weaker storage.
- Per-record encryption: `AES-256-GCM`, fresh 12-byte IV per record, AAD binds `userId|chatId|recordId` so records can't be swapped between chats or users.
- Messages are cached **already-decrypted-then-recrypted**: the E2E layer stays untouched; the cache stores the rendered plaintext under the CMK, so opening a chat does not require re-running ECDH for every message (this is the main speed win).
- Copying the IndexedDB files yields only ciphertext + timestamps; the CMK is not in the database.

## Database changes (backend)

Minimal — sync is cursor-based, so we only need reliable ordering and tombstones:

- `messages`: ensure an index on `(chat_id, updated_at)` for delta pulls.
- Add `updated_at` maintenance trigger on `messages` if not already present, so edits/deletes surface in deltas.
- New `public.message_tombstones` (id, chat_id, deleted_at) written by the existing delete paths, so clients can purge cached rows for messages that no longer exist. RLS: participants read only.
- New per-user setting column `max_privacy_mode boolean default false` on `user_profiles`.

## Synchronization strategy

- Per chat, keep `last_synced_at` in `meta`. On open: render cache instantly → fire `messages where chat_id = ? and updated_at > cursor` → merge → advance cursor.
- Realtime stays the primary live path; the delta pull is the reconciliation path on resume/reconnect/app start.
- Conflicts: server wins on content and status (`updated_at` comparison), local wins only for rows still in the outbox.
- Outbox: an offline send writes a local row with `sync_state: 'pending'` and renders with a clock "Pending" indicator; the flusher runs on `vt-network-online`, app resume, and a backoff timer, then rewrites the row with the server id.
- Startup pulls only the newest N (default 50) messages per chat for the 20 most-recent chats; older pages load on scroll and are cached as they're read.

## Offline behaviour

- Chat list, cached conversations, and already-viewed media render with no network.
- Media: only files the user actually opened/downloaded are cached, stored encrypted under the CMK in the `media` store, with an LRU sweep (default 250 MB / 30 days, configurable in Settings → Storage).
- A subtle offline banner replaces error toasts; composer stays enabled.

## Maximum Privacy Mode

New toggle in Settings → Privacy. When on:
- Cache lives in memory + session-scoped IndexedDB only; the whole database and the wrapped CMK are wiped on logout.
- Decrypted in-memory maps are cleared when the app is backgrounded (`vt-app-paused` / `visibilitychange`), forcing a re-decrypt on return.
- Trust Lock chats are **never** written to the cache in any mode; secured/vault chats are likewise excluded, matching the existing "hidden from list" rule.

## Security implications

- Threat covered: device file-system copy, backup extraction, offline forensic access — all yield ciphertext.
- Not covered: a rooted device with the app unlocked and the CMK resident in memory (same bound as every mainstream messenger).
- E2E model is unchanged; no plaintext leaves the device and no keys go to the server.
- Cache is namespaced per `user.id`; logout clears the other user's namespace, which also removes the class of bug behind the earlier "user B sees user A's chats" report.

## Performance impact

- Chat open: network round-trip (300–2000 ms on slow links) → single IndexedDB read + AES decrypt (~5–20 ms for 50 messages).
- Battery: fewer full refetches; the 30 s list poll becomes a delta poll and backs off when offline/backgrounded.
- Memory: only the active chat plus the list summary are held decrypted; older pages are evicted.
- Storage: text cache is bounded per chat (default 500 messages), media by the LRU budget.

## Migration strategy

1. Ship the cache layer behind a flag, writing to the cache while still rendering from network — pure shadow mode.
2. Flip reads to cache-first for the chat list (it already has a plaintext `sessionStorage` cache; that gets replaced by the encrypted store in the same step).
3. Flip reads to cache-first for the conversation view; skeleton logic reduced to "no cached rows for this chat".
4. Remove the legacy `sessionStorage` chat cache and clear any existing key on upgrade.
- No server-side breaking change; older app builds keep working since sync is additive.

## Rollout notes

- Native Keystore/Keychain wrapping requires a new Capacitor plugin and therefore an Android/iOS rebuild. Web and PWA get the PIN-derived path with no rebuild.
- Suggested build order: cache-db + crypto → chat list cache-first → conversation cache-first → outbox/pending → media cache → Maximum Privacy Mode → native secure store.
