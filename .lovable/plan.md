## Tribes Overhaul Plan

This is a large, multi-part change. Outlining the full scope so you can confirm before I build. Once approved I'll ship it in ordered DB → backend → UI batches.

### 1. Terminology rename (app-wide)
- "Group" → "Tribe", "Group admin" → "Tribe Leader", "Create New Group" → "Create New Tribe", chats tab "Groups" → "Tribes", subtitle "Group chat" → "Tribe chat".
- Code identifiers (`is_group`, `CreateGroupModal`, etc.) stay as-is to avoid breaking migrations; only user-visible strings change. i18n keys updated.

### 2. Database changes (one migration)
New columns on `chats` (only used when `is_group = true`):
- `handle` text unique (the `@tribename`, immutable except by master admin)
- `privacy` text check in ('public','private') default 'private'
- `description` text
- `created_by` already exists — becomes the founding Tribe Leader (cannot be demoted/removed)

`chat_members` additions:
- `role` text check in ('leader','member') default 'member'

New tables:
- `tribe_invites` (id, chat_id, code unique, created_by, expires_at nullable, revoked_at nullable)
- `tribe_join_requests` (id, chat_id, user_id, status: pending/approved/declined, decided_by, decided_at)

Update RLS:
- Only leaders can update `chats` row for tribe (name/avatar/description/privacy/handle subject to immutability rule), insert/delete `chat_members` (except self-leave), update member `role`.
- Founder protection enforced via trigger: cannot delete/demote `created_by`.
- Master admin bypass via existing `is_admin_user()`.
- Anyone authenticated can read minimal tribe info (name/avatar/handle/privacy) via a `tribe_public` view for invite-link previews and global search.
- Public tribes: any authenticated user can insert themselves into `chat_members`.
- Private tribes: insert via valid invite code OR approved join request.

System messages:
- Reuse `messages` table with `sender_id = NULL` and a `message_type` column (new) = 'system' (created, joined, left, role_changed, privacy_changed, name_changed). Renderable as centered grey pill.

### 3. Tribe details panel
Click header (red-circled area) opens a right-side sheet (mobile: full screen) showing:
- Avatar (leader can edit), name, `@handle`, privacy badge, description, created date + founder.
- Member list with avatars, "Tribe Leader" tag for leaders, chat icon → opens 1:1 chat.
- Counts ("X members"), search within members.
- Actions per viewer:
  - **All members**: leave tribe, mute, delete chat for me, view info, start DM with member.
  - **Leaders**: add members, promote/demote (not founder), remove (not founder), edit name/avatar/description, toggle privacy (with confirmation banner explaining sync), generate/copy/revoke invite link, approve/decline join requests.
  - **Founder only**: same as leader; cannot be removed/demoted by others.
  - **Master admin** (non-member): all leader powers; can view info but messages hidden if private + not member.

### 4. Invite links & join flow
- Route `/tribe/join/$code` (public, SSR head with tribe name only).
- Page fetches via public server fn returning name+avatar only.
- If signed-out → CTA to sign in then return.
- If signed-in → "Join Tribe" / "Ignore" buttons.
  - Public tribe → instant join.
  - Private tribe via valid invite → instant join.
  - Private tribe without invite → "Request to join" → creates `tribe_join_requests` row.
- On accept: system message "X joined the tribe".
- On decline: requester gets notification "Your request to join @tribe was declined".

### 5. Privacy toggle + handle
- Setting handle: modal warns "This @handle is permanent and cannot be changed later" before save.
- Toggling privacy: modal explains "Switching to Public means anyone can join without approval. Existing pending requests will be auto-approved" and vice versa.
- Handle searchable in `GlobalSearchBar` (extends search to `chats.handle` for `is_group=true`).

### 6. Messages — leader delete + per-user delete
- Existing `deleted_for` / `deleted_for_everyone` already supports both.
- Add long-press menu option "Delete for everyone (as Tribe Leader)" — visible to leaders on any message in the tribe; sets `deleted_for_everyone=true`. RLS update to allow leaders.
- Members keep existing "delete for me" / "delete for everyone (own messages only, time-limited)".

### 7. Automated system messages
On insert into `chat_members` for a tribe → trigger inserts system message ("X joined the tribe"); on delete → ("X left the tribe"); on tribe create → ("Tribe created on {date} by Tribe Leader {name}"); on role change / privacy change / name change → corresponding system messages.

### 8. Admin Panel — new "Tribes" tab (master admin only)
- New tab between Users and Support, visible only when `is_master_admin`.
- List of all tribes: avatar, name, `@handle`, privacy, member count, founder name, created date.
- Sort by name / created date (asc/desc), search box.
- Click row → tribe detail page reusing the member-facing details panel with full leader permissions. Messages tab hidden when tribe is private and admin is not a member.
- Admin can edit handle (the only path to change it post-creation).

### 9. Admin Panel — remove "Blocked" filter
- Remove the Blocked chip from the Users tab filters (image 2).

### 10. Files affected (high level)
- New migration (DB schema + RLS + triggers).
- `src/components/CreateGroupModal.tsx` → renamed strings, optional handle/privacy/description at create time.
- `src/pages/components/ChatWindowPanel.tsx` → make header clickable, open `TribeDetailsSheet`.
- New `src/components/TribeDetailsSheet.tsx` (the panel).
- New `src/components/TribeInviteModal.tsx`, `src/components/TribePrivacyToggleDialog.tsx`, `src/components/TribeHandleDialog.tsx`.
- New route `src/routes/tribe.join.$code.tsx` + public server fn `src/lib/tribes.public.functions.ts`.
- New server fns `src/lib/tribes.functions.ts` (create/update/promote/demote/remove/leave/toggle-privacy/set-handle/generate-invite/approve-request).
- `src/pages/components/ChatListPanel.tsx` → tab label "Tribes".
- `src/components/GlobalSearchBar.tsx` → handle search.
- `src/pages/AdminPage.tsx` → new Tribes tab (master-admin gated), remove Blocked filter.
- `src/contexts/LanguageContext.tsx` / `src/lib/i18n.ts` → updated copy.

### Estimated batches
1. Migration (schema + RLS + triggers + system-message trigger)
2. Server functions + public invite route
3. Tribe details sheet + dialogs + header click wiring
4. Terminology rename + Tribes tab label + handle search
5. Admin Tribes tab + remove Blocked filter

### Open questions before I start
1. **Handle uniqueness scope**: globally unique across the whole platform (so it can be searched as `@handle`)? Assuming yes.
2. **Invite link format**: `https://vibtribe.in/tribe/join/<code>` — OK? Codes 10-char base62, never expire by default, leader can revoke.
3. **Founder transfer**: should the founder be able to transfer founder status to another leader before leaving? (I'll skip this v1 unless you want it — founder simply cannot leave unless they delete the tribe or another leader is promoted first.)
4. **Message edit for tribe name/avatar after creation**: leaders can edit name freely, right? (Only `@handle` is immutable.)

Reply with answers (or "go ahead with your defaults") and I'll start with the migration.