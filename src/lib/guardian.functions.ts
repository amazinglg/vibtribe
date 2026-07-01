import * as React from 'react'
import { render } from '@react-email/components'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { template as guardianOtpTemplate } from '@/lib/email-templates/guardian-otp'
import { template as guardianConsentRequestTemplate } from '@/lib/email-templates/guardian-consent-request'

const SITE_NAME = 'VibTribe'
const SENDER_DOMAIN = 'notify.www.vibtribe.in'
const FROM_DOMAIN = 'www.vibtribe.in'
const SITE_ORIGIN = 'https://www.vibtribe.in'

async function enqueueTemplateEmail(params: {
  supabase: any
  to: string
  subject: string
  html: string
  text: string
  label: string
  queueName?: 'auth_emails' | 'transactional_emails'
}) {
  const { supabase, to, subject, html, text, label, queueName = 'auth_emails' } = params
  const messageId = crypto.randomUUID()
  const normalizedTo = to.trim().toLowerCase()

  // Ensure unsubscribe token exists
  let unsubscribeToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedTo)
    .maybeSingle()
  if (existing?.token && !existing.used_at) {
    unsubscribeToken = existing.token
  } else {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const fresh = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: fresh, email: normalizedTo }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedTo)
      .maybeSingle()
    unsubscribeToken = stored?.token ?? fresh
  }

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: label,
    recipient_email: to,
    status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: queueName,
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label,
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) throw new Error(error.message)
}

/**
 * Minor submits/updates guardian details. Server generates a 6-digit OTP,
 * stores its bcrypt hash on the DB row, and emails it to the guardian.
 * The bare OTP is returned by the RPC but NEVER returned to the client
 * from this server function.
 */
export const submitGuardianDetails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      guardianName: z.string().min(2).max(120),
      guardianEmail: z.string().email().max(254),
      guardianMobile: z.string().min(6).max(20),
      relationship: z.enum(['parent', 'mother', 'father', 'legal_guardian', 'grandparent', 'other']),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const { data: rows, error } = await supabase.rpc('submit_guardian_details' as any, {
      _guardian_name: data.guardianName,
      _guardian_email: data.guardianEmail,
      _guardian_mobile: data.guardianMobile,
      _relationship: data.relationship,
    })
    if (error) throw new Error(error.message)
    const row: any = Array.isArray(rows) ? rows[0] : rows
    if (!row?.consent_token || !row?.otp_code) throw new Error('Guardian record could not be created')

    // Fetch minor name for the email
    const { data: minor } = await supabase
      .from('user_profiles')
      .select('full_name, username')
      .eq('id', context.userId)
      .maybeSingle()
    const minorName = (minor?.full_name || minor?.username || 'A young user') as string

    const otpEl = React.createElement(guardianOtpTemplate.component, {
      code: row.otp_code,
      minorName,
      guardianName: data.guardianName,
    })
    const subject = typeof guardianOtpTemplate.subject === 'string'
      ? guardianOtpTemplate.subject
      : (guardianOtpTemplate.subject as (d: Record<string, any>) => string)({})
    await enqueueTemplateEmail({
      supabase,
      to: data.guardianEmail,
      subject,
      html: await render(otpEl),
      text: await render(otpEl, { plainText: true }),
      label: 'guardian_otp',
    })

    return { ok: true, guardianEmail: row.guardian_email }
  })

/**
 * Minor submits the OTP the guardian shared with them. On success we send
 * the guardian the full consent-request email containing the /guardian-consent/:token link.
 */
export const verifyGuardianEmailOtp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const { data: ok, error } = await supabase.rpc('verify_guardian_email_otp' as any, {
      _code: data.code,
    })
    if (error) throw new Error(error.message)
    if (!ok) return { ok: false as const }

    // Fetch latest guardian row + minor name
    const { data: rowArr } = await supabase
      .from('guardian_consents' as any)
      .select('id, guardian_name, guardian_email, relationship, consent_token, consented_at')
      .eq('minor_user_id', context.userId)
      .is('revoked_at', null)
      .is('graduated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    const row: any = Array.isArray(rowArr) ? rowArr[0] : rowArr
    if (!row) return { ok: true as const }
    if (row.consented_at) return { ok: true as const, alreadyConsented: true }

    const { data: minor } = await supabase
      .from('user_profiles')
      .select('full_name, username')
      .eq('id', context.userId)
      .maybeSingle()
    const minorName = (minor?.full_name || minor?.username || 'A young user') as string
    const consentUrl = `${SITE_ORIGIN}/guardian-consent/${row.consent_token}`

    const el = React.createElement(guardianConsentRequestTemplate.component, {
      consentUrl,
      minorName,
      guardianName: row.guardian_name,
      relationship: row.relationship,
    })
    const subject = typeof guardianConsentRequestTemplate.subject === 'function'
      ? guardianConsentRequestTemplate.subject({ minorName })
      : guardianConsentRequestTemplate.subject
    await enqueueTemplateEmail({
      supabase,
      to: row.guardian_email,
      subject,
      html: await render(el),
      text: await render(el, { plainText: true }),
      label: 'guardian_consent_request',
      queueName: 'transactional_emails',
    })

    return { ok: true as const, sentTo: row.guardian_email as string }
  })

/**
 * Read the current guardian record for the signed-in minor. Used by
 * /guardian-setup to render status ("Email OTP sent", "Waiting for guardian
 * to consent", etc.).
 */
export const getMyGuardianStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase
    const { data, error } = await supabase
      .from('guardian_consents' as any)
      .select('id, guardian_name, guardian_email, guardian_mobile, relationship, email_verified_at, consented_at, revoked_at, created_at, updated_at')
      .eq('minor_user_id', context.userId)
      .is('graduated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return { record: data ?? null }
  })

/**
 * Public server function called from the guardian consent page. Uses the
 * unauthenticated `record_guardian_consent` RPC. IP + UA are captured
 * server-side, not from client-provided values.
 */
export const recordGuardianConsentPublic = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      { auth: { persistSession: false } },
    )
    const { getRequestHeader, getRequestIP } = await import('@tanstack/react-start/server')
    let ip: string | null = null
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null } catch { /* ignore */ }
    const ua = getRequestHeader('user-agent') ?? null
    const { error } = await supabase.rpc('record_guardian_consent' as any, {
      _token: data.token,
      _ip: ip,
      _user_agent: ua,
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const revokeGuardianConsentPublic = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      { auth: { persistSession: false } },
    )
    const { getRequestHeader, getRequestIP } = await import('@tanstack/react-start/server')
    let ip: string | null = null
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null } catch { /* ignore */ }
    const ua = getRequestHeader('user-agent') ?? null
    const { error } = await supabase.rpc('revoke_guardian_consent' as any, {
      _token: data.token,
      _ip: ip,
      _user_agent: ua,
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getGuardianConsentByToken = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      { auth: { persistSession: false } },
    )
    const { data: rows, error } = await supabase.rpc('get_guardian_consent_by_token' as any, {
      _token: data.token,
    })
    if (error) throw new Error(error.message)
    const row = Array.isArray(rows) ? rows[0] : rows
    return { record: row ?? null }
  })