# E2E Encryption (PIN-Backed) + Edit/Delete Messages

## Part 1: True E2E Encryption with 6-digit PIN

### How it works
1. **First time setup** — When a signed-in user opens the app and has no encryption key yet, a modal asks them to **set a 6-digit Encryption PIN**.
2. We generate an ECDH keypair, then derive an AES key from their PIN using PBKDF2 (100k iterations + random salt).
3. The private key is encrypted with that AES key and uploaded to the database. The public key is also stored.
4. **New device / cleared cache** — App detects local IndexedDB is empty but DB has an encrypted blob → asks for PIN → decrypts → caches locally.
5. **Sending a message** — Real ECDH key exchange + AES-GCM encryption. Server only sees ciphertext.
6. **Existing users** — Auto-migration: on next login, they're prompted to set their PIN. No backend batch needed; their unread/future messages are encrypted from that point. Old plaintext messages stay readable.

### Database changes
- `user_profiles`: add `encrypted_private_key` (text), `key_salt` (text), `key_iv` (text), `key_setup_completed` (bool)
- Public key column already exists.

### Files
- Rewrite `src/lib/encryption.ts` (PIN-derived key wrap, real ECDH/AES-GCM)
- New `src/components/EncryptionPinModal.tsx` (set / unlock PIN)
- Wire into `AuthContext` to surface modal on login when needed

## Part 2: Message Edit / Delete for Sender

### Long-press menu (own messages only)
- **Edit** — inline edit; saves new ciphertext, marks `edited_at`
- **Delete for me** — adds my user_id to `deleted_for[]`, message hidden only for me
- **Delete for both** — only if message is < 1 hour old; sets `deleted_for_everyone=true`; renders as "🚫 This message was deleted" for everyone

### Database changes
- `messages`: add `edited_at` (timestamptz), `deleted_for_everyone` (bool), `deleted_for` (uuid[] default '{}')
- New SECURITY DEFINER RPC `delete_message_for_me(_msg_id uuid)` so users can update their own row in `deleted_for` even when they aren't the sender
- Update messages RLS UPDATE to allow sender to set `deleted_for_everyone` within 1 hour and to update `content`/`edited_at`

### UI changes (ChatWindowPanel)
- Long-press (touchstart hold 500ms) + right-click handlers on own message bubbles
- Context menu component with Edit / Delete-for-me / Delete-for-both
- Inline edit input
- Render "This message was deleted" for `deleted_for_everyone`
- Filter out messages where current user is in `deleted_for`
- Handle realtime UPDATE for edits and tombstones

## Verification
1. Apply migration
2. Sign in as test user → PIN setup modal appears → set PIN → keys generated
3. Send message → verify DB row content starts with `e2e:` (ciphertext)
4. Long-press own message → edit, delete-for-me, delete-for-both — verify each behaves correctly
5. Reload app → PIN unlock prompt → message decrypts back to plaintext in UI

## Honest caveats
- Lost PIN = lost message history (same tradeoff as Signal/Telegram). Modal will warn.
- Group chats remain unencrypted (no multi-party key exchange in this iteration).
- Encrypted media is still not supported — text only in E2E chats.
