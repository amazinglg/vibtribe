
Domain `notify.www.vibtribe.in` is now **verified and active** — emails will send. Good news: the 6-digit OTP flow for signup and password reset is already implemented end-to-end (see `src/routes/api/public/auth-otp.ts`, `SignUpPage`, `ForgotPasswordPage`) and the 5-OTP / 24h rate limit already exists via `check_otp_rate_limit`. So this plan focuses on what's missing and your new requirements.

## 1. Verify the OTP flow is live (test path)

- Walk through `/sign-up` with a fresh email → confirm 6-digit code email arrives from `noreply@www.vibtribe.in`, code verifies, account is created.
- No magic-link / confirmation-link flow remains anywhere in the codebase (already removed).

## 2. Email templates — branded with app logo, no unsubscribe on auth

- `otp-code.tsx` and `welcome.tsx` already use the app logo (`https://www.vibtribe.in/icons/icon-192x192.png`). Polish styling to match VibTribe brand (dark accent, rounded card, monospace OTP).
- **Auth emails already skip the unsubscribe footer** — only transactional emails append it (per `send-transactional-email` route). Will verify and add explicit `purpose: 'auth'` gating on welcome email so the welcome mail also has no unsubscribe (it's account-related, not marketing).

## 3. Rate limit — 5 OTPs per 24h (already done) + admin reset

Already enforced server-side via `check_otp_rate_limit` + `issue_email_otp` raising `OTP_RATE_LIMITED`. Adds:

- New SQL function `admin_reset_otp_attempts(_user_id uuid)` — master-admin only, deletes all `email_otp_codes` rows for that user's email in the last 24h, resetting the window.
- New server function `adminResetOtpAttempts` (auth-protected, checks `has_role(auth.uid(), 'master_admin')`).
- New button on `AdminUserDetailPage` → "Reset OTP attempts (5 remaining)" — visible only to master admin. Confirms via dialog, calls server fn, toasts success.
- Keep this completely separate from the existing admin "Reset password" action (which uses `auth.admin.updateUserById`).

## 4. Unsubscribe deep link → profile → notification settings

- Update unsubscribe email link target from `/unsubscribe?token=…` to `/unsubscribe?token=…&redirect=notifications`.
- `src/routes/unsubscribe.tsx` after successful unsubscribe:
  - If PWA installed (detect via `navigator.standalone` / `display-mode: standalone`) → `navigate('/profile-screen?tab=notifications')`.
  - Else if on web → same in-app navigation (the website is the app).
- Add `?tab=notifications` query handling in `ProfileScreenPage` / `ProfileContent` to auto-open the Notifications section and scroll to it.
- Verify all notification toggles (push, chat, status, etc.) are bound to backend state with proper sync (no UI-only toggles).

## 5. Email privacy — only self, admin, master-admin

- Audit `user_profiles` RLS: ensure `real_email` and `email` columns are **not** returned to other users. Add a column-aware policy or a view `public_user_profiles` (no email columns) that other users query instead.
- Update all components currently selecting `email` / `real_email` from other users (ContactsPanel, ChatWindow, etc.) to use the safe view.
- "My Profile" / Account page: show the user's own `real_email` (read-only display + "change email" later).
- Admin user list + `AdminUserDetailPage`: show `real_email` (admins already allowed via RLS).

## 6. Terms & Conditions

- Update `src/components/legal/LegalContent.tsx` to add a section explaining: we store your email address for account recovery, security notifications, and (with consent) product updates; emails are visible only to you and platform administrators.

## 7. Database cleanup — proposed deletions

Will **only delete after you approve**. Candidates flagged as unused:

| Object | Reason |
|---|---|
| `public.force_logout_tokens` | Not referenced anywhere in `src/` code. Confirm before drop. |
| `public.user_secure_chats` | Not referenced anywhere in `src/` code. Confirm before drop. |
| Old `email_send_log` rows with `template_name = 'magic_link' / 'signup_link'` | Legacy from link-based flow (if any). |

I'll grep the codebase one more time before dropping anything. Tables like `email_otp_codes`, `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, `push_subscriptions`, `support_tickets` are actively used — keep.

## 8. Out of scope for this round (per your instruction)

- Backfilling OTP flow for existing users — only new signups for now, as you asked.
- Email change flow for existing users.

---

## Technical sketch

- Migration: `admin_reset_otp_attempts` SQL function + RLS check via `has_role`.
- Migration: optional `public_user_profiles` view + revoke email columns from `authenticated` on base table (keeps admin/self access via policy).
- New server fn: `src/lib/admin.functions.ts` → `adminResetOtpAttempts`.
- UI: button in `AdminUserDetailPage`, notifications-tab deep-link in `ProfileScreenPage` + `unsubscribe.tsx` redirect.
- Template polish: `src/lib/email-templates/otp-code.tsx`, `welcome.tsx`.
- Legal copy: `src/components/legal/LegalContent.tsx`.
- DB drops (separate migration, only after your confirm).

Approve and I'll execute end-to-end, then ask you to test a fresh signup.
