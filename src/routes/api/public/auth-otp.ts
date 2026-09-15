import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { enqueueTransactionalEmail } from '@/lib/email-enqueue.server'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

function generateCode(): string {
  const buf = new Uint8Array(4)
  crypto.getRandomValues(buf)
  const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0
  return String(n % 1_000_000).padStart(6, '0')
}

function syntheticEmail(mobileFull: string): string {
  const digits = (mobileFull || '').replace(/\D/g, '')
  return `${digits.slice(-10)}@vibetribe.app`
}

async function enqueueOtpEmail(
  _supabase: ReturnType<typeof getAdminClient>,
  to: string,
  code: string,
  purpose: 'signup' | 'password_reset',
  name?: string,
) {
  const result = await enqueueTransactionalEmail({
    templateName: 'otp-code',
    recipientEmail: to,
    templateData: { code, purpose, name },
    idempotencyKey: `otp-${purpose}-${to.trim().toLowerCase()}-${code}`,
  })
  if (!result.ok && result.status !== 'suppressed') throw new Error(result.error || 'OTP email failed')
}

const emailSchema = z.string().trim().toLowerCase().email().max(255)
const codeSchema = z.string().regex(/^\d{6}$/, '6-digit code required')
const passwordSchema = z.string().min(6).max(72)
// Reject characters that have meaning inside PostgREST `.or()` filter strings
// (commas, parentheses, colons) to prevent filter-clause injection in send_reset.
const identifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .regex(/^[^,()\s:]+$/, 'Invalid characters in identifier')

const SendSignup = z.object({
  action: z.literal('send_signup'),
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().regex(/^\+\d{1,4}$/).optional(),
  mobileNumber: z.string().trim().regex(/^\+?\d{7,16}$/).optional(),
})
const SendReset = z.object({
  action: z.literal('send_reset'),
  identifier: identifierSchema,
})
const CreateAccount = z.object({
  action: z.literal('create_account'),
  email: emailSchema,
  code: codeSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(120),
  username: z.string().trim().regex(/^[a-z0-9_]{3,30}$/).optional(),
  countryCode: z.string().trim().regex(/^\+\d{1,4}$/),
  mobileNumber: z.string().trim().regex(/^\+?\d{7,16}$/),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})
const ResetPwd = z.object({
  action: z.literal('reset_password'),
  identifier: identifierSchema,
  code: codeSchema,
  newPassword: passwordSchema,
})

const SendVerifyExisting = z.object({
  action: z.literal('send_verify_existing'),
  email: emailSchema,
})
const VerifyExisting = z.object({
  action: z.literal('verify_existing'),
  email: emailSchema,
  code: codeSchema,
})

const Body = z.discriminatedUnion('action', [
  SendSignup, SendReset, CreateAccount, ResetPwd, SendVerifyExisting, VerifyExisting,
])

function jerr(status: number, error: string) {
  return Response.json({ error }, { status })
}

export const Route = createFileRoute('/api/public/auth-otp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof Body>
        try {
          const raw = await request.json()
          payload = Body.parse(raw)
        } catch (e: any) {
          return jerr(400, e?.message || 'Invalid request')
        }

        const supabase = getAdminClient()

        // Helper: identify the authenticated caller from the Authorization header.
        async function getAuthedUserId(): Promise<string | null> {
          const h = request.headers.get('authorization') || request.headers.get('Authorization') || ''
          const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
          if (!token) return null
          const { data, error } = await supabase.auth.getUser(token)
          if (error || !data?.user) return null
          return data.user.id
        }

        // SEND SIGNUP OTP
        if (payload.action === 'send_signup') {
          // Block list check (offboarded users cannot sign up again)
          {
            let mobileHash: string | null = null
            if (payload.countryCode && payload.mobileNumber) {
              const fullMobile = payload.mobileNumber.startsWith('+')
                ? payload.mobileNumber
                : `${payload.countryCode}${payload.mobileNumber}`
              const { data: hashResult } = await supabase.rpc(
                'compute_mobile_hash' as any,
                { _mobile: fullMobile },
              )
              mobileHash = (hashResult as string) || null
            }
            const { data: isBlocked } = await supabase.rpc(
              'is_signup_blocked' as any,
              { _email: payload.email, _mobile_hash: mobileHash },
            )
            if (isBlocked === true) {
              return jerr(
                403,
                'This account has been blocked from re-registering. If you believe this is a mistake, please use the appeal link that was sent to your email or contact support.',
              )
            }
          }

          // Don't allow signup OTP to an email already linked to an account
          const { data: avail } = await supabase.rpc('is_real_email_available', { _email: payload.email })
          if (avail === false) return jerr(409, 'This email is already linked to an account')

          // If mobile was provided up front, also block duplicate mobile numbers
          if (payload.countryCode && payload.mobileNumber) {
            const fullMobile = payload.mobileNumber.startsWith('+')
              ? payload.mobileNumber
              : `${payload.countryCode}${payload.mobileNumber}`
            const mobileLocal = fullMobile.replace(payload.countryCode, '').replace(/\D/g, '')
            const { data: mobAvail } = await supabase.rpc('is_mobile_available', {
              _country_code: payload.countryCode,
              _mobile: mobileLocal,
            })
            if (mobAvail === false) return jerr(409, 'This mobile number is already linked to an account')
          }

          // Rate limit: 5 OTP requests per email per rolling 24h
          const { data: remaining } = await supabase.rpc('check_otp_rate_limit', { _email: payload.email })
          if (typeof remaining === 'number' && remaining <= 0) {
            return jerr(429, 'Too many code requests. Please try again in 24 hours.')
          }

          const code = generateCode()
          const { error: issueErr } = await supabase.rpc('issue_email_otp', {
            _email: payload.email, _code: code, _purpose: 'signup',
          })
          if (issueErr) {
            if ((issueErr.message || '').includes('OTP_RATE_LIMITED')) {
              return jerr(429, 'Too many code requests. Please try again in 24 hours.')
            }
            return jerr(500, 'Failed to issue code')
          }
          try {
            await enqueueOtpEmail(supabase, payload.email, code, 'signup', payload.name)
          } catch (e: any) {
            console.error('enqueue otp signup failed', e)
            return jerr(500, 'Failed to send code')
          }
          return Response.json({ ok: true })
        }

        // SEND RESET OTP — look up account's real_email by identifier
        if (payload.action === 'send_reset') {
          const id = payload.identifier.toLowerCase()
          const digits = id.replace(/\D/g, '')
          const isMobile = !id.includes('@') && digits.length >= 10
          const { data: prof } = await supabase
            .from('user_profiles')
            .select('real_email, full_name')
            .or(
              [
                `real_email.eq.${id}`,
                `email.eq.${id}`,
                ...(digits.length >= 10 ? [`mobile_number.like.%${digits.slice(-10)}`] : []),
              ].join(','),
            )
            .limit(1)
            .maybeSingle()

          // When the user looks up by mobile number, surface a clear error if
          // no account / no email is on file so they know to contact support.
          // For email-style identifiers we still return ok to avoid leaking
          // account existence.
          if (isMobile && (!prof || !prof.real_email)) {
            return jerr(
              404,
              'No email is registered with this mobile number. Please contact support for help.',
            )
          }

          if (prof?.real_email) {
            const { data: remaining } = await supabase.rpc('check_otp_rate_limit', { _email: prof.real_email })
            if (typeof remaining === 'number' && remaining <= 0) {
              // Return ok to avoid leaking account existence; user retries later
              return Response.json({ ok: true })
            }
            const code = generateCode()
            const { error: issueErr } = await supabase.rpc('issue_email_otp', {
              _email: prof.real_email, _code: code, _purpose: 'password_reset',
            })
            if (!issueErr) {
              try {
                await enqueueOtpEmail(supabase, prof.real_email, code, 'password_reset', prof.full_name || undefined)
              } catch (e) { console.error('enqueue otp reset failed', e) }
            }
          }
          return Response.json({ ok: true })
        }

        // CREATE ACCOUNT (verifies signup OTP, then provisions user)
        if (payload.action === 'create_account') {
          // Re-check block list (defence in depth against races)
          {
            const fullMobile = payload.mobileNumber.startsWith('+')
              ? payload.mobileNumber
              : `${payload.countryCode}${payload.mobileNumber}`
            const { data: hashResult } = await supabase.rpc('compute_mobile_hash' as any, { _mobile: fullMobile })
            const { data: isBlocked } = await supabase.rpc('is_signup_blocked' as any, {
              _email: payload.email,
              _mobile_hash: (hashResult as string) || null,
            })
            if (isBlocked === true) {
              return jerr(403, 'This account has been blocked from re-registering.')
            }
          }

          const ok = await supabase.rpc('consume_email_otp', {
            _email: payload.email, _code: payload.code, _purpose: 'signup',
          })
          if (ok.error || ok.data !== true) return jerr(400, 'Invalid or expired code')

          // Defense-in-depth: re-verify email + mobile are still unique
          const { data: emailAvail } = await supabase.rpc('is_real_email_available', { _email: payload.email })
          if (emailAvail === false) return jerr(409, 'This email is already linked to an account')

          // Build the synthetic auth email from mobile number
          const fullMobile = payload.mobileNumber.startsWith('+')
            ? payload.mobileNumber
            : `${payload.countryCode}${payload.mobileNumber}`
          const mobileLocal = fullMobile.replace(payload.countryCode, '').replace(/\D/g, '')
          const { data: mobAvail2 } = await supabase.rpc('is_mobile_available', {
            _country_code: payload.countryCode,
            _mobile: mobileLocal,
          })
          if (mobAvail2 === false) return jerr(409, 'This mobile number is already linked to an account')

          const authEmail = syntheticEmail(fullMobile)

          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: authEmail,
            password: payload.password,
            email_confirm: true,
            user_metadata: {
              full_name: payload.fullName,
              mobile_number: fullMobile,
              country_code: payload.countryCode,
              avatar_url: payload.avatarUrl || '',
              ...(payload.username ? { username: payload.username } : {}),
              dob: payload.dob,
              role: 'user',
            },
          })
          if (createErr || !created.user) {
            console.error('createUser failed', createErr)
            return jerr(400, createErr?.message || 'Failed to create account')
          }

          let ageYears = 999
          try {
            const [y, m, d] = payload.dob.split('-').map(n => parseInt(n, 10))
            const dobD = new Date(Date.UTC(y, m - 1, d))
            const now = new Date()
            ageYears = now.getUTCFullYear() - dobD.getUTCFullYear()
            const anniv = new Date(Date.UTC(now.getUTCFullYear(), dobD.getUTCMonth(), dobD.getUTCDate()))
            if (now < anniv) ageYears -= 1
          } catch {}
          // Hard-block sign-up for anyone under 13, regardless of country.
          if (ageYears < 13) {
            // Roll back the freshly-created auth user so the account isn't left dangling.
            try { await supabase.auth.admin.deleteUser(created.user.id) } catch {}
            return jerr(403, 'You must be at least 13 years old to sign up on VibTribe.')
          }
          // Users aged 13-17 must go through the guardian consent flow (all countries).
          const isMinor = ageYears < 18
          await supabase
            .from('user_profiles')
            .update({
              real_email: payload.email,
              country_code: payload.countryCode,
              ...(payload.username ? { username: payload.username } : {}),
              dob: payload.dob,
              ...(isMinor ? { account_status: 'pending_guardian' } : {}),
            })
            .eq('id', created.user.id)

          // Fire welcome email (non-blocking)
          try {
            const welcome = await enqueueTransactionalEmail({
              templateName: 'welcome',
              recipientEmail: payload.email,
              templateData: { name: payload.fullName },
              idempotencyKey: `welcome-${created.user.id}`,
            })
            if (!welcome.ok && welcome.status !== 'suppressed') throw new Error(welcome.error || 'Welcome email failed')
          } catch (e) {
            console.error('welcome email send failed', e)
          }

          return Response.json({ ok: true, authEmail })
        }

        // RESET PASSWORD via OTP
        if (payload.action === 'reset_password') {
          const { error } = await supabase.rpc('reset_password_with_otp', {
            _identifier: payload.identifier,
            _code: payload.code,
            _new_password: payload.newPassword,
          })
          if (error) return jerr(400, error.message || 'Failed to reset password')
          return Response.json({ ok: true })
        }

        // SEND VERIFICATION OTP for an existing logged-in user adding/changing email
        if (payload.action === 'send_verify_existing') {
          const userId = await getAuthedUserId()
          if (!userId) return jerr(401, 'Not authenticated')

          // Reject if email already linked to a different account
          const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('real_email', payload.email)
            .neq('id', userId)
            .maybeSingle()
          if (existingProfile) return jerr(409, 'This email is already linked to another account')

          const { data: remaining } = await supabase.rpc('check_otp_rate_limit', { _email: payload.email })
          if (typeof remaining === 'number' && remaining <= 0) {
            return jerr(429, 'Too many code requests. Please try again in 24 hours.')
          }

          const code = generateCode()
          const { error: issueErr } = await supabase.rpc('issue_email_otp', {
            _email: payload.email, _code: code, _purpose: 'signup',
          })
          if (issueErr) {
            if ((issueErr.message || '').includes('OTP_RATE_LIMITED')) {
              return jerr(429, 'Too many code requests. Please try again in 24 hours.')
            }
            return jerr(500, 'Failed to issue code')
          }
          // Look up name for personalized email
          const { data: prof } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', userId)
            .maybeSingle()
          try {
            await enqueueOtpEmail(supabase, payload.email, code, 'signup', prof?.full_name || undefined)
          } catch (e: any) {
            console.error('enqueue verify existing failed', e)
            return jerr(500, 'Failed to send code')
          }
          return Response.json({ ok: true })
        }

        // VERIFY OTP and attach real_email to the logged-in user's profile
        if (payload.action === 'verify_existing') {
          const userId = await getAuthedUserId()
          if (!userId) return jerr(401, 'Not authenticated')

          const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('real_email', payload.email)
            .neq('id', userId)
            .maybeSingle()
          if (existingProfile) return jerr(409, 'This email is already linked to another account')

          const ok = await supabase.rpc('consume_email_otp', {
            _email: payload.email, _code: payload.code, _purpose: 'signup',
          })
          if (ok.error || ok.data !== true) return jerr(400, 'Invalid or expired code')

          const { error: updErr } = await supabase
            .from('user_profiles')
            .update({ real_email: payload.email })
            .eq('id', userId)
          if (updErr) return jerr(500, updErr.message || 'Failed to save email')

          return Response.json({ ok: true })
        }

        return jerr(400, 'Unknown action')
      },
    },
  },
})