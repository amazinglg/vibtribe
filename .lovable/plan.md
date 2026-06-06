
# VibTribe Marketing Email System — Implementation Plan

A production-grade, DPDP / GDPR / CAN-SPAM compliant promotional email system built on **Resend** with a dedicated subdomain `news.vibtribe.in`, an in-app admin composer, per-recipient sending (no BCC), consent capture at signup, a re-consent flow for existing users, and full audit logging.

---

## 1. Prerequisites you (Labhansh) need to do once

These cannot be automated and block the "send" step. Everything else I'll build regardless.

1. **Create a Resend account** at resend.com (free tier = 3,000 emails/month, 100/day — enough to test; upgrade to Pro $20/mo before first real blast).
2. **Add domain `news.vibtribe.in`** in Resend → Domains → Add Domain.
3. **Add the DNS records Resend shows you** at your DNS provider (SPF TXT, 3× DKIM CNAMEs, optional MX, DMARC TXT). Since `vibtribe.in` is bought through Lovable, you'll add them in Project Settings → Domains → Configure → Manage DNS records.
4. **Wait for Resend to show "Verified"** (5 min – 2 hrs typically).
5. **Generate a Resend API key** (Resend → API Keys → Create → "Full access" or "Sending access" only).
6. **Hand me the key** — I'll request it via `add_secret` as `RESEND_API_KEY`.

While DNS propagates, I'll build everything else.

---

## 2. Sender identity (locked in)

| Setting | Value |
|---|---|
| From | `VibTribe <hello@news.vibtribe.in>` |
| Reply-To | `Labhansh.garg@outlook.com` |
| Marketing subdomain | `news.vibtribe.in` (isolated from `notify.www.vibtribe.in` which keeps OTP/auth pristine) |
| Physical address in footer | "Labhansh Garg, Founder — VibTribe · Labhansh.garg@outlook.com" (per your instruction to use email as address for now) |
| Grievance officer | Labhansh Garg, Founder · Labhansh.garg@outlook.com |

---

## 3. Database changes (one migration)

### 3a. Extend `user_profiles`
- `marketing_consent_at` `timestamptz` — when the user opted in
- `marketing_consent_ip` `text` — IP captured at consent
- `marketing_consent_source` `text` — `'signup'`, `'reconsent_modal'`, `'profile_settings'`, `'imported_legacy'`

### 3b. Backfill existing users
The current default of `email_marketing_opt_in = true` is **not DPDP/GDPR-compliant** (consent must be explicit, not assumed). I'll:
- Set `email_marketing_opt_in = false` for all existing users (the safe default)
- Change the column default to `false` going forward
- Existing users get a one-time **re-consent modal** the next time they open the app (see §6b)

### 3c. New tables

**`email_campaigns`**
- id, subject, preheader, content_html, banner_image_url
- audience_filter (jsonb — `{ type: 'opted_in' | 'all' | 'active_7d' | 'active_30d' }`)
- status: `draft | sending | sent | failed`
- created_by, created_at, sent_at, sent_count, failed_count, total_recipients

**`email_campaign_recipients`**
- campaign_id, user_id, email, status (`queued | sent | failed | unsubscribed_before_send`), resend_message_id, error_message, sent_at

RLS: only `is_master_admin()` can read/write campaigns. Recipients writable only by `service_role`.

### 3d. Reuse existing infra
- Reuse the existing `email_unsubscribe_tokens` table and `/email/unsubscribe` route (already wired in your project).
- Reuse `suppressed_emails` — campaign sender checks it before every send.

---

## 4. Server functions & routes (server-side only — keys never touch the client)

| File | Purpose |
|---|---|
| `src/lib/marketing.functions.ts` | `createCampaign`, `updateCampaign`, `listCampaigns`, `getCampaign`, `sendTestEmail(campaignId, toEmail)`, `sendCampaign(campaignId)`, `getCampaignStats(id)`, `previewAudienceSize(filter)`. All gated by `requireSupabaseAuth` + `is_master_admin()` check. |
| `src/lib/marketing.server.ts` | `resendSend()` helper — calls Resend HTTP API with `RESEND_API_KEY` from `process.env`, retries on 429, returns message_id. |
| `src/routes/api/public/resend-webhook.ts` | Receives Resend bounce/complaint webhooks. On `bounced` / `complained` → insert into `suppressed_emails` + flip `email_marketing_opt_in = false`. Verifies signature via Resend's Svix headers. |
| Reuse `src/routes/email/unsubscribe.ts` | Already handles one-click unsubscribe. I'll extend it to flip `email_marketing_opt_in = false` in `user_profiles` (in addition to current behavior). |

### Sending engine (the heart of it)
- Fetches recipients in **batches of 100**
- Sends **one Resend API call per recipient** (no BCC) using their personal unsubscribe token in `List-Unsubscribe` header + footer
- **Rate limit:** 10 emails/second (well under Resend's 100/sec Pro tier limit)
- Each result logged to `email_campaign_recipients` immediately
- Failures don't stop the batch
- Long-running send is kicked off and runs to completion server-side; admin UI polls campaign status

---

## 5. Admin UI: `/admin/marketing`

### Tab integration
Current admin tabs need a 6th tab. I'll:
- Shorten existing tab labels slightly (e.g. "Tickets" stays, "Users" stays)
- Make the tab strip horizontally scrollable on mobile with snap-to-tab (single-line as you required on desktop)
- Add **"Marketing"** tab, gated by `is_master_admin`

### Page layout
1. **Campaigns list** — table of past + draft campaigns with status, sent/failed counts, "View report" link
2. **New Campaign button** → opens composer

### Composer
- Subject + preheader inputs
- Optional banner image upload (to existing `chat-media` bucket, public)
- Rich text editor (Tiptap — lightweight, already React-friendly) with image embedding, links, lists, headings, bold/italic
- **Live preview pane** with Desktop / Mobile toggle (375px iframe for mobile)
- Auto-appended footer preview (cannot be removed): VibTribe + physical address + unsubscribe link
- Audience selector with **live count** ("This will send to 1,247 opted-in users")
- **"Send test to me"** button — sends only to the logged-in admin's email
- **"Send to all"** button — confirms with modal showing exact recipient count, then kicks off the send

### Campaign report (post-send)
- Total sent, failed, bounced, complained, unsubscribed
- Searchable recipient table with per-row status
- Re-send to failed (only)

---

## 6. Consent flow — new users AND existing users

### 6a. New signups (SignUpPage)
- Add an **unchecked** checkbox: *"Send me product updates, tips, and announcements from VibTribe. You can unsubscribe anytime."*
- On submit: if checked, write `email_marketing_opt_in=true`, `marketing_consent_at=now()`, `marketing_consent_ip=<client IP>`, `marketing_consent_source='signup'`
- If unchecked, marketing stays off — transactional/auth emails (OTP, password reset, ticket replies) continue regardless

### 6b. Existing users — one-time re-consent modal
- On first app load after this ships, show a non-dismissible-but-skippable modal: *"We're updating how we handle email. Would you like to receive product updates and announcements? (You can change this anytime in Profile → Notifications.)"*
- Three buttons: **Yes, subscribe me** / **No thanks** / **Decide later**
- "Decide later" hides for 7 days then reappears (max 3 prompts, then defaults to opted-out)
- Choice stored with `marketing_consent_source='reconsent_modal'`
- **Until they answer, they receive zero marketing email** (the migration in §3b already set everyone to opt-out)

### 6c. Profile settings
- Already exists at Profile → Notifications. I'll add a clear "Promotional emails" toggle separated from transactional toggles, with timestamp display ("Subscribed on Jan 15, 2026").

---

## 7. Privacy Policy & Terms updates (`LegalContent.tsx`)

Append to **Terms § 5a (Email Address)**:
> "If you opted in, we may also send promotional emails (product updates, announcements, tips). You can unsubscribe via the link in every promotional email or from Profile → Notifications. Withdrawing consent does not affect security and transactional emails."

Add new **Privacy Policy § I — Marketing Emails**:
- What we send (product updates, tips, announcements)
- Legal basis: your explicit consent (DPDP § 6, GDPR Art. 6(1)(a))
- How to withdraw: one-click unsubscribe or Profile settings
- We log consent timestamp + IP for compliance
- Right to lodge complaint with India's Data Protection Board / your EU DPA
- Sender: VibTribe, Labhansh Garg (Founder), Labhansh.garg@outlook.com

Update **§ 13 Grievance Officer** — already lists you, no change needed.

Update **TermsAcceptanceGate** — bumps the "Last updated" date forcing existing users to re-accept (covers the legal requirement of notifying users of material changes).

---

## 8. Compliance checklist (what this satisfies)

| Requirement | How it's met |
|---|---|
| **DPDP (India) — explicit consent** | Unchecked checkbox at signup; re-consent modal for existing users; timestamp+IP logged |
| **DPDP — notice in plain language** | New Privacy § I, surfaced at signup and in re-consent modal |
| **DPDP — grievance officer** | Already in Terms § 13 (you), email in every campaign footer |
| **GDPR Art. 6(1)(a) — consent basis** | Same explicit opt-in flow; consent withdrawable in 1 click |
| **GDPR Art. 7(3) — easy withdrawal** | One-click unsub link (no login) + profile toggle |
| **CAN-SPAM — physical address** | Auto-appended in every campaign footer |
| **CAN-SPAM — clear sender** | "VibTribe <hello@news.vibtribe.in>" |
| **CAN-SPAM — honor opt-outs <10 days** | Immediate (DB flip on click) |
| **CAN-SPAM — no deceptive subjects** | Admin UI shows compliance hint; can't be auto-enforced |
| **Gmail/Yahoo 2024 — SPF+DKIM+DMARC** | Resend handles automatically once DNS verified |
| **Gmail/Yahoo 2024 — one-click List-Unsubscribe header** | Set on every send |
| **Gmail/Yahoo 2024 — <0.3% spam rate** | Achieved by opt-in-only + suppression list + per-recipient sends |

---

## 9. Build order (what I'll do, in order)

1. **Migration** — schema changes, backfill existing users to opted-out, new tables, RLS, grants
2. **Server functions** — `marketing.functions.ts` + Resend HTTP helper
3. **Resend webhook route** — `/api/public/resend-webhook` for bounces/complaints
4. **Extend unsubscribe route** — flip `email_marketing_opt_in` in `user_profiles`
5. **Admin UI** — `/admin/marketing` page + composer + audience picker + send flow + report
6. **Admin tab strip** — fit the new "Marketing" tab on web + mobile (single-line, scrollable on small screens)
7. **Signup checkbox** — consent capture on SignUpPage
8. **Re-consent modal** — `MarketingConsentGate` component shown after login for users without `marketing_consent_at`
9. **Profile toggle** — add to existing Profile → Notifications
10. **Legal pages** — update Terms § 5a + add Privacy § I + bump "Last updated"
11. **Request `RESEND_API_KEY`** from you as the final step (after DNS verified)

---

## 10. What I'll confirm at the end (per your final-output checklist)

1. ✅ Sender: `VibTribe <hello@news.vibtribe.in>`
2. ⏳ SPF/DKIM/DMARC: handled by Resend; verified once you complete §1 steps 2–4
3. ✅ Unsubscribe: footer link → `/email/unsubscribe?token=...` → flips `email_marketing_opt_in=false` + inserts into `suppressed_emails` (instant, no login required)
4. ✅ Logs: `email_campaigns` (campaign metadata) + `email_campaign_recipients` (per-recipient outcomes, errors, Resend message IDs)
5. ✅ DPDP/GDPR/CAN-SPAM compliant (see §8 matrix)
6. ✅ Signup: unchecked checkbox + IP/timestamp; existing users: 1-time re-consent modal w/ 3-prompt cap then default-off

---

## Estimated work
~90–120 minutes of build time. I'll batch the migration first (needs your approval), then ship the rest in parallel.

**Approve this plan and I'll start with the migration.** The `RESEND_API_KEY` request will come last so you have time to do the DNS setup in parallel.
