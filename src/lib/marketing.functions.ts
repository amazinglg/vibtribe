import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import {
  resendSend,
  wrapCampaignHtml,
  htmlToText,
  MARKETING_FROM,
} from './marketing.server'

// ---------- shared helpers (server-only) ----------

async function assertMaster(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('is_master_admin')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data?.is_master_admin) {
    throw new Error('Master admin access required')
  }
}

function buildUnsubUrl(token: string): string {
  return `https://www.vibtribe.in/email/unsubscribe?token=${encodeURIComponent(token)}`
}

async function getOrCreateUnsubToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existing?.token && !existing.used_at) return existing.token
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const fresh = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .upsert({ token: fresh, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: stored } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()
  return stored?.token ?? fresh
}

type AudienceFilter = { type: 'opted_in' | 'all' | 'active_7d' | 'active_30d' }

async function fetchAudience(filter: AudienceFilter): Promise<Array<{ id: string; email: string }>> {
  let q = supabaseAdmin
    .from('user_profiles')
    .select('id, real_email, email_marketing_opt_in, last_seen')
    .not('real_email', 'is', null)

  if (filter.type !== 'all') {
    q = q.eq('email_marketing_opt_in', true)
  }
  if (filter.type === 'active_7d') {
    q = q.gte('last_seen', new Date(Date.now() - 7 * 86400_000).toISOString())
  } else if (filter.type === 'active_30d') {
    q = q.gte('last_seen', new Date(Date.now() - 30 * 86400_000).toISOString())
  }

  const all: Array<{ id: string; email: string }> = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data) {
      const e = (r.real_email || '').trim().toLowerCase()
      if (e && e.includes('@')) all.push({ id: r.id, email: e })
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  // dedupe by email
  const seen = new Set<string>()
  return all.filter(r => (seen.has(r.email) ? false : (seen.add(r.email), true)))
}

const CampaignDraft = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().min(1).max(200),
  preheader: z.string().max(200).optional().nullable(),
  contentHtml: z.string().min(1).max(200_000),
  bannerImageUrl: z.string().url().optional().nullable().or(z.literal('')),
  audienceFilter: z.object({
    type: z.enum(['opted_in', 'all', 'active_7d', 'active_30d']),
  }),
})

// ---------- server functions ----------

export const listCampaigns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId)
    const { data } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    return { campaigns: data ?? [] }
  })

export const getCampaign = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const { data: campaign } = await supabaseAdmin
      .from('email_campaigns').select('*').eq('id', data.id).maybeSingle()
    if (!campaign) throw new Error('Campaign not found')
    const { data: recipients } = await supabaseAdmin
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', data.id)
      .order('created_at', { ascending: false })
      .limit(500)
    return { campaign, recipients: recipients ?? [] }
  })

export const saveCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CampaignDraft.parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const row = {
      subject: data.subject,
      preheader: data.preheader || null,
      content_html: data.contentHtml,
      banner_image_url: data.bannerImageUrl || null,
      audience_filter: data.audienceFilter,
      created_by: context.userId,
    }
    if (data.id) {
      const { data: upd } = await supabaseAdmin
        .from('email_campaigns')
        .update(row).eq('id', data.id).eq('status', 'draft').select().maybeSingle()
      if (!upd) throw new Error('Cannot edit a campaign that has been sent')
      return { campaign: upd }
    }
    const { data: ins, error } = await supabaseAdmin
      .from('email_campaigns').insert(row).select().single()
    if (error) throw new Error(error.message)
    return { campaign: ins }
  })

export const previewAudienceSize = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audienceFilter: AudienceFilter }) =>
    z.object({ audienceFilter: z.object({ type: z.enum(['opted_in', 'all', 'active_7d', 'active_30d']) }) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const aud = await fetchAudience(data.audienceFilter)
    return { count: aud.length }
  })

export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; toEmail: string }) =>
    z.object({ campaignId: z.string().uuid(), toEmail: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const { data: c } = await supabaseAdmin
      .from('email_campaigns').select('*').eq('id', data.campaignId).maybeSingle()
    if (!c) throw new Error('Campaign not found')
    const token = await getOrCreateUnsubToken(data.toEmail)
    const unsubscribeUrl = buildUnsubUrl(token)
    const html = wrapCampaignHtml({
      subject: c.subject,
      preheader: c.preheader || undefined,
      bodyHtml: c.content_html,
      bannerImageUrl: c.banner_image_url,
      unsubscribeUrl,
      recipientEmail: data.toEmail,
    })
    const result = await resendSend({
      to: data.toEmail,
      subject: `[TEST] ${c.subject}`,
      html,
      text: htmlToText(html),
      unsubscribeUrl,
    })
    if (!result.ok) throw new Error(result.error || 'Resend failed')
    return { ok: true, messageId: result.id, from: MARKETING_FROM }
  })

export const sendCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string }) =>
    z.object({ campaignId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    const { data: c } = await supabaseAdmin
      .from('email_campaigns').select('*').eq('id', data.campaignId).maybeSingle()
    if (!c) throw new Error('Campaign not found')
    if (c.status !== 'draft') throw new Error(`Campaign is already ${c.status}`)

    const audience = await fetchAudience(c.audience_filter as AudienceFilter)

    // Load suppression list once
    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails').select('email')
    const supSet = new Set((suppressed ?? []).map(s => s.email.toLowerCase()))

    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'sending', total_recipients: audience.length })
      .eq('id', data.campaignId)

    // Insert queued recipient rows in bulk
    const recipientRows = audience.map(a => ({
      campaign_id: data.campaignId,
      user_id: a.id,
      email: a.email,
      status: supSet.has(a.email) ? 'skipped_suppressed' : 'queued',
    }))
    // chunked insert
    for (let i = 0; i < recipientRows.length; i += 500) {
      await supabaseAdmin
        .from('email_campaign_recipients')
        .insert(recipientRows.slice(i, i + 500))
    }

    let sent = 0
    let failed = 0
    const sendable = audience.filter(a => !supSet.has(a.email))

    for (const r of sendable) {
      try {
        const token = await getOrCreateUnsubToken(r.email)
        const unsubscribeUrl = buildUnsubUrl(token)
        const html = wrapCampaignHtml({
          subject: c.subject,
          preheader: c.preheader || undefined,
          bodyHtml: c.content_html,
          bannerImageUrl: c.banner_image_url,
          unsubscribeUrl,
          recipientEmail: r.email,
        })
        const result = await resendSend({
          to: r.email, subject: c.subject, html, text: htmlToText(html), unsubscribeUrl,
        })
        if (result.ok) {
          sent++
          await supabaseAdmin
            .from('email_campaign_recipients')
            .update({ status: 'sent', resend_message_id: result.id, sent_at: new Date().toISOString() })
            .eq('campaign_id', data.campaignId).eq('email', r.email)
        } else {
          failed++
          await supabaseAdmin
            .from('email_campaign_recipients')
            .update({ status: 'failed', error_message: result.error?.slice(0, 500) })
            .eq('campaign_id', data.campaignId).eq('email', r.email)
          // Hard 401/403 → abort early
          if (result.status === 401 || result.status === 403) {
            await supabaseAdmin
              .from('email_campaigns')
              .update({ status: 'failed', sent_count: sent, failed_count: failed })
              .eq('id', data.campaignId)
            throw new Error('Resend authentication failed — check RESEND_API_KEY')
          }
        }
        // gentle pacing — 10/sec
        await new Promise(r => setTimeout(r, 100))
      } catch (e: any) {
        failed++
        await supabaseAdmin
          .from('email_campaign_recipients')
          .update({ status: 'failed', error_message: (e?.message || 'unknown').slice(0, 500) })
          .eq('campaign_id', data.campaignId).eq('email', r.email)
      }
    }

    await supabaseAdmin
      .from('email_campaigns')
      .update({
        status: failed > 0 && sent === 0 ? 'failed' : 'sent',
        sent_at: new Date().toISOString(),
        sent_count: sent,
        failed_count: failed,
      })
      .eq('id', data.campaignId)

    return { ok: true, sent, failed, total: audience.length, skipped: audience.length - sendable.length }
  })

export const deleteCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId)
    await supabaseAdmin.from('email_campaigns').delete().eq('id', data.id)
    return { ok: true }
  })

// ---------- consent capture ----------

export const recordMarketingConsent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { optIn: boolean; source: 'signup' | 'reconsent_modal' | 'profile_settings' }) =>
    z.object({
      optIn: z.boolean(),
      source: z.enum(['signup', 'reconsent_modal', 'profile_settings']),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let ip = 'unknown'
    try {
      const mod: any = await import('@tanstack/react-start')
      const getHeader = mod.getRequestHeader
      if (typeof getHeader === 'function') {
        ip = (getHeader('x-forwarded-for') as string | undefined)?.split(',')[0]?.trim()
          || (getHeader('cf-connecting-ip') as string | undefined)
          || 'unknown'
      }
    } catch { /* ignore — IP capture is best-effort */ }

    await supabaseAdmin
      .from('user_profiles')
      .update({
        email_marketing_opt_in: data.optIn,
        marketing_consent_at: new Date().toISOString(),
        marketing_consent_ip: ip,
        marketing_consent_source: data.source,
      })
      .eq('id', context.userId)
    return { ok: true }
  })

export const getMyMarketingConsent = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('email_marketing_opt_in, marketing_consent_at, marketing_consent_source')
      .eq('id', context.userId)
      .maybeSingle()
    return {
      optIn: !!data?.email_marketing_opt_in,
      consentAt: data?.marketing_consent_at ?? null,
      source: data?.marketing_consent_source ?? null,
      hasAnswered: !!data?.marketing_consent_at,
    }
  })