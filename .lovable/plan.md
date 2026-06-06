# Marketing Overhaul + Permissions Tab

Big batch of work. I'll group it so the highest-risk items (test send not arriving, permissions tab) get done first and you can verify incrementally.

---

## Group A — Diagnose & fix the test send (Issue 1)

Before any UI changes, find out why the test send to `labhanshgarg.3@gmail.com` didn't arrive.

Likely root causes (in order of probability):
1. **Resend `from` not on a verified domain** — `hello@news.vibtribe.in` may not yet be verified in Resend (domain added but DNS not propagated/verified). In that case Resend silently rejects.
2. **Wrong/old `RESEND_API_KEY`** — rotated key not picked up by runtime.
3. **Send returned 200 but Gmail filtered it to Spam/Promotions** — check spam folder first.

What I'll do:
- Query `email_campaigns` / recipients for the last test send result.
- Hit Resend `/domains` via the API key to confirm `news.vibtribe.in` status.
- Add proper server-side logging into `email_send_log` for marketing sends too (currently only stored on the campaign recipient row — easy to miss).
- Surface the Resend API response (id / error) in the admin UI toast so future failures are visible.

---

## Group B — Compose UX overhaul (Issues 2, 3, 8, 9)

**2. Rich-text editor instead of raw HTML.**
Add a WYSIWYG editor (Tiptap — already React-friendly, small, no extra services). Toolbar: bold, italic, underline, strike, H1/H2/H3, bullet/numbered lists, link, alignment, font-size, text color, clear formatting. The editor produces clean HTML that we store in `content_html` — DB schema unchanged.

**3. Banner upload from device** (replaces URL field).
- Create a `marketing-banners` Supabase Storage bucket (public read).
- New file-picker control: user picks an image → uploaded → public URL stored in existing `banner_image_url` column. Show preview + "Remove" button. URL field goes away.

**8. Audience dropdown cleanup.**
- Default to **Opted-in users**.
- Remove "All users (ignore opt-in)" and both "Active in last X days" options.
- Only option left = Opted-in users. (I'll either keep the dropdown with one option locked, or just show a static label — I'll go with the static label, cleaner.)
- Backend still validates `audience_filter.type === 'opted_in'`.

**9. Beautiful, professional email template** (Claude-inspired).
Redesign `wrapCampaignHtml` in `marketing.server.ts`:
- Light cream/off-white background (like Claude's `#f5f0e8`), not dark.
- Brand header with VibTribe logo + wordmark.
- Editorial serif headline pairing (e.g. Instrument Serif) with sans body.
- Card-style CTA blocks if the user uses the editor's "Card" insert (stretch — basic version first).
- Footer: clean divider, social icons (IG/X/LinkedIn placeholders the user can edit later), App Store + Play Store badges, physical address line, recipient email line, one-click unsubscribe + privacy.

**4. Footer cleanup.**
Remove `"VibTribe · Labhansh Garg, Founder · Labhansh.garg@outlook.com"` from email footer entirely. Keep it only in Terms and Privacy pages (already there — no change needed). Email footer will instead show: brand, short tagline, address city/country only ("VibTribe, India"), unsubscribe + privacy links.

---

## Group C — Campaign list & drafts (Issues 5, 7)

**5. Sent campaigns log** on the main Marketing page:
Table with columns: Subject · Sent date/time · Audience · Sent by (admin name) · Recipients · Sent/Failed counts · Status badge.
Source: `email_campaigns` joined to `user_profiles` on `created_by`.

**7. Drafts section + edit.**
Above the "New Campaign" button add a "Drafts" panel (collapsible or always-visible list). Each draft row: subject · last edited · pencil edit icon · delete. Edit icon opens the compose view pre-filled. Editing is already supported by `saveCampaign` when `status='draft'`.

Layout: page becomes two stacked sections — **Drafts** (top) and **Sent campaigns** (below). "New Campaign" button stays top-right.

---

## Group D — Admin access (Issue 6)

Currently `/admin/marketing` checks `is_master_admin` only. Change so any user with the `admin` role *or* `is_master_admin` can access. I'll update both the route guard and the server-fn `assertMaster` → `assertAdminOrMaster` for marketing functions.

(Permissions matrix in Group E will eventually drive this dynamically, but for now a simple role check.)

---

## Group E — Permissions tab (Issue 10) — biggest piece

I'll use cross-project tools to read the SVN project (`07a74aa3-...`) and study how its permission matrix is built (table structure, toggle logic, "Add Role" flow).

Then for VibTribe:
- New table `role_permissions` (role, section, can_view, can_write) + `app_roles` table (role name, is_system).
- Seed with current sections: Dashboard, Users, Tribes, Status, Support, Marketing, Permissions.
- New page `/admin/permissions` — master-admin-only — with the matrix UI (toggles per role per section, Add Role input).
- Master Admin role hidden from the matrix.
- Hard-coded guard: phone number `9826016419` (your account) is always treated as master admin, no UI can downgrade it. I'll add this as a DB-level check in the `has_role` / permission-check function.
- Wire existing admin sections to read from `role_permissions` instead of hard-coded `is_master_admin` checks (gradual — I'll wire Marketing + Permissions itself first, others can follow).
- New tab in admin nav after "Marketing" — visible only to master admin. Aligned in web + mobile (will update both the desktop tab bar and mobile menu).

---

## Order I'll ship

1. **Group A** — diagnose test send, report findings, fix.
2. **Group D** — quick admin role gate fix.
3. **Group C + B(8)** — drafts panel, sent log, audience cleanup (smaller wins).
4. **Group B(2,3,4,9)** — editor, upload, template redesign.
5. **Group E** — permissions tab (largest piece, done last).

I'll check in after Groups A–D so you can verify, then continue to B(2-4,9) and E.

---

## One question before I start

**Group E hard-coded master admin pin** — you said your account `9826016419` should always have master admin. I see two safer ways to enforce that:

- **(a) DB trigger** that prevents `is_master_admin = false` or role downgrades on the user record matching that phone. Tamper-proof even via SQL.
- **(b) Application-level** — UI just hides controls for that user, and server fn refuses updates.

I'll do **both (a)+(b)** unless you say otherwise — belt and suspenders.

If this plan looks good, reply "go" and I'll start with Group A.
