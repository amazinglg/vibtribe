import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { template as otpTemplate } from '@/lib/email-templates/otp-code'

const SITE_NAME = 'vibtribe'
const SENDER_DOMAIN = 'notify.www.vibtribe.in'
const FROM_DOMAIN = 'www.vibtribe.in'

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
  supabase: ReturnType<typeof getAdminClient>,
  to: string,
  code: string,
  purpose: 'signup' | 'password_reset',
  name?: string,
) {
  const subj = typeof otpTemplate.subject === 'function'
    ? otpTemplate.subject({ purpose })
    : otpTemplate.subject
  const element = React.createElement(otpTemplate.component, { code, purpose, name })
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const messageId = crypto.randomUUID()

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: `otp_${purpose}`,
    recipient_email: to,
    status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: subj,
      html,
      text,
      purpose: 'transactional',
      label: `otp_${purpose}`,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) throw new Error(error.message)
}

const emailSchema = z.string().trim().toLowerCase().email().max(255)
const codeSchema = z.string().regex(/^\d{6}$/, '6-digit code required')
const passwordSchema = z.string().min(6).max(72)
const identifierSchema = z.string().trim().min(3).max(255)

const SendSignup = z.object({
  action: z.literal('send_signup'),
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
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
  username: z.string().trim().regex(/^[a-z0-9_]{3,30}$/),
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

const Body = z.discriminatedUnion('action', [SendSignup, SendReset, CreateAccount, ResetPwd])

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

        // SEND SIGNUP OTP
        if (payload.action === 'send_signup') {
          // Don't allow signup OTP to an email already linked to an account
          const { data: avail } = await supabase.rpc('is_real_email_available', { _email: payload.email })
          if (avail === false) return jerr(409, 'This email is already linked to an account')

          const code = generateCode()
          const { error: issueErr } = await supabase.rpc('issue_email_otp', {
            _email: payload.email, _code: code, _purpose: 'signup',
          })
          if (issueErr) return jerr(500, 'Failed to issue code')
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

          // Always return ok to avoid leaking account existence
          if (prof?.real_email) {
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
          const ok = await supabase.rpc('consume_email_otp', {
            _email: payload.email, _code: payload.code, _purpose: 'signup',
          })
          if (ok.error || ok.data !== true) return jerr(400, 'Invalid or expired code')

          // Build the synthetic auth email from mobile number
          const fullMobile = payload.mobileNumber.startsWith('+')
            ? payload.mobileNumber
            : `${payload.countryCode}${payload.mobileNumber}`
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
              username: payload.username,
              dob: payload.dob,
              role: 'user',
            },
          })
          if (createErr || !created.user) {
            console.error('createUser failed', createErr)
            return jerr(400, createErr?.message || 'Failed to create account')
          }

          // Persist real_email + extras on profile
          await supabase
            .from('user_profiles')
            .update({
              real_email: payload.email,
              country_code: payload.countryCode,
              username: payload.username,
              dob: payload.dob,
            })
            .eq('id', created.user.id)

          // Fire welcome email (non-blocking)
          try {
            const welcomeId = crypto.randomUUID()
            const { template: welcomeTpl } = await import('@/lib/email-templates/welcome')
            const el = React.createElement(welcomeTpl.component, { name: payload.fullName })
            const html = await render(el)
            const text = await render(el, { plainText: true })
            const subj = typeof welcomeTpl.subject === 'function'
              ? (welcomeTpl.subject as (d: Record<string, any>) => string)({ name: payload.fullName })
              : welcomeTpl.subject
            await supabase.from('email_send_log').insert({
              message_id: welcomeId,
              template_name: 'welcome',
              recipient_email: payload.email,
              status: 'pending',
            })
            await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: welcomeId,
                to: payload.email,
                from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: subj,
                html, text,
                purpose: 'transactional',
                label: 'welcome',
                queued_at: new Date().toISOString(),
              },
            })
          } catch (e) {
            console.error('welcome email enqueue failed', e)
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

        return jerr(400, 'Unknown action')
      },
    },
  },
})