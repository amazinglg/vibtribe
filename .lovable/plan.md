# Restore chat identity and device push registration

## Goal
Restore names, photos, online state, and encryption keys in chats, forwarding, and calls without reopening private profile data. Ensure reused Android devices can save their notification token for the currently signed-in account.

## Changes
- Replace direct reads of other users' profile rows with the existing limited signed-in profile lookup.
- Extend that lookup only with the public encryption key required for end-to-end encrypted messages.
- Update chat lists, chat windows, forwarding, reporting snapshots, and incoming-call identity lookups.
- Replace direct notification-token upserts with a secure claim operation that derives ownership from the signed-in session.
- Return a failed registration result when token persistence fails instead of silently reporting success.

## Security boundaries
- Keep private profile fields inaccessible through direct profile-table reads.
- Expose only display fields, presence fields, and the public encryption key through the profile lookup.
- Never accept a user ID from the app when claiming a notification token; use the authenticated account ID in the database.
- Keep existing row-level restrictions on notification tokens.

## Verification
- Confirm no affected chat, forwarding, or call path directly reads another user's profile row.
- Confirm the limited lookup returns the fields each affected screen needs.
- Confirm a token previously owned by another account can be reassigned only to the currently signed-in account.
- Run focused checks and verify the preview still loads.
- Resolve only the two supplied Project monitoring findings.
