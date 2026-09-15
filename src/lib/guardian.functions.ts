import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { enqueueTransactionalEmail } from '@/lib/email-enqueue.server'

const SITE_ORIGIN = 'https://www.vibtribe.in'

async function sendGuardianEmail(params: {
  to: string
  templateName: 'guardian-otp' | 'guardian-consent-request'
  templateData: Record<string, any>
  idempotencyKey: string
}) {
  const result = await enqueueTransactionalEmail({
    templateName: params.templateName,
    recipientEmail: params.to,
    templateData: params.templateData,
    idempotencyKey: params.idempotencyKey,
  })
  if (!result.ok && result.status !== 'suppressed') throw new Error(result.error || 'Email send failed')
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

    await sendGuardianEmail({
      to: data.guardianEmail,
      templateName: 'guardian-otp',
      templateData: { code: row.otp_code, minorName, guardianName: data.guardianName },
      idempotencyKey: `guardian-otp-${context.userId}-${row.consent_token}`,
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

    // Fetch latest guardian row + minor name via SECURITY DEFINER RPC (avoids
    // exposing the guardian_consents row — including OTP hash / IP / UA — to
    // the minor via direct table SELECT).
    const { data: rowArr } = await supabase.rpc('get_my_guardian_send_target' as any)
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

    await sendGuardianEmail({
      to: row.guardian_email,
      templateName: 'guardian-consent-request',
      templateData: { consentUrl, minorName, guardianName: row.guardian_name, relationship: row.relationship },
      idempotencyKey: `guardian-consent-${context.userId}-${row.consent_token}`,
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
    const { data: rows, error } = await supabase.rpc('get_my_guardian_status' as any)
    if (error) throw new Error(error.message)
    const record: any = Array.isArray(rows) ? rows[0] ?? null : rows ?? null
    return { record }
  })

/**
 * Re-send the guardian OTP using details already stored server-side. The
 * client never receives the guardian's raw email/mobile — those are pulled
 * with the service-role client scoped to the caller's own minor account.
 */
export const resendGuardianOtp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: existing, error: readErr } = await (supabaseAdmin as any)
      .from('guardian_consents')
      .select('guardian_name, guardian_email, guardian_mobile, relationship')
      .eq('minor_user_id', context.userId)
      .is('revoked_at', null)
      .is('graduated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (readErr) throw new Error(readErr.message)
    if (!existing) throw new Error('No pending guardian record to resend')

    const supabase = context.supabase
    const { data: rows, error } = await supabase.rpc('submit_guardian_details' as any, {
      _guardian_name: existing.guardian_name,
      _guardian_email: existing.guardian_email,
      _guardian_mobile: existing.guardian_mobile,
      _relationship: existing.relationship,
    })
    if (error) throw new Error(error.message)
    const row: any = Array.isArray(rows) ? rows[0] : rows
    if (!row?.otp_code) throw new Error('Could not regenerate OTP')

    const { data: minor } = await supabase
      .from('user_profiles')
      .select('full_name, username')
      .eq('id', context.userId)
      .maybeSingle()
    const minorName = (minor?.full_name || minor?.username || 'A young user') as string

    await sendGuardianEmail({
      to: existing.guardian_email,
      templateName: 'guardian-otp',
      templateData: { code: row.otp_code, minorName, guardianName: existing.guardian_name },
      idempotencyKey: `guardian-otp-resend-${context.userId}-${row.consent_token || crypto.randomUUID()}`,
    })
    return { ok: true as const }
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