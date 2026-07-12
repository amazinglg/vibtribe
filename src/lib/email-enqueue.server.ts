// Server-only helper for enqueuing transactional emails from within trusted
// server code (cron hooks, admin server functions) WITHOUT going through the
// user-authenticated /lovable/email/transactional/send route.
//
// SECURITY: This module uses the service-role Supabase client and MUST NOT be
// imported from any client-reachable module at top level. Load it inside a
// handler with `await import(...)`.

import * as React from 'react'
import { render } from '@react-email/components'
import { sendLovableEmail } from '@lovable.dev/email-js'
import { TEMPLATES } from './email-templates/registry'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// Must stay in sync with /lovable/email/transactional/send.ts
const SITE_NAME = 'vibtribe'
const SENDER_DOMAIN = 'notify.www.vibtribe.in'
const FROM_DOMAIN = 'www.vibtribe.in'

export interface EnqueueOpts {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

export interface EnqueueResult {
  ok: boolean
  status: 'queued' | 'suppressed' | 'unknown_template' | 'error'
  messageId?: string
  error?: string
}

export async function enqueueTransactionalEmail(
  opts: EnqueueOpts,
): Promise<EnqueueResult> {
  const template = TEMPLATES[opts.templateName]
  if (!template) {
    return { ok: false, status: 'unknown_template', error: `Unknown template ${opts.templateName}` }
  }
  const recipient = template.to || opts.recipientEmail
  if (!recipient) {
    return { ok: false, status: 'error', error: 'recipientEmail is required' }
  }
  const normalized = recipient.toLowerCase()
  const messageId = crypto.randomUUID()
  const idempotencyKey = opts.idempotencyKey || messageId

  // Suppression check. Promotional opt-outs must not block app emails such as
  // account-deletion notices; hard bounces/complaints still do.
  const { data: suppressed, error: supErr } = await supabaseAdmin
    .from('suppressed_emails')
    .select('id, reason')
    .eq('email', normalized)
    .maybeSingle()
  if (supErr) {
    return { ok: false, status: 'error', error: 'Suppression check failed' }
  }
  if (suppressed && (suppressed as any).reason !== 'user_opt_out') {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'suppressed',
    })
    return { ok: false, status: 'suppressed', messageId }
  }

  // Get or create unsubscribe token — Lovable Email API requires it for
  // transactional sends (missing_unsubscribe → 400).
  let unsubscribeToken: string | undefined
  {
    const { data: existing } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalized)
      .maybeSingle()
    if (existing && !existing.used_at) {
      unsubscribeToken = (existing as any).token
    } else if (!existing) {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const newToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
      await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .upsert({ token: newToken, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
      const { data: stored } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalized)
        .maybeSingle()
      unsubscribeToken = (stored as any)?.token || newToken
    }
  }

  const element = React.createElement(template.component, opts.templateData || {})
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function'
    ? template.subject(opts.templateData || {})
    : template.subject

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const payload = {
    message_id: messageId,
    to: recipient,
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    sender_domain: SENDER_DOMAIN,
    subject,
    html,
    text,
    purpose: 'transactional',
    label: opts.templateName,
    idempotency_key: idempotencyKey,
    unsubscribe_token: unsubscribeToken,
    queued_at: new Date().toISOString(),
  }

  const apiKey = process.env.LOVABLE_API_KEY
  if (apiKey) {
    try {
      await sendLovableEmail(payload, { apiKey, sendUrl: process.env.LOVABLE_SEND_URL })
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: opts.templateName,
        recipient_email: recipient,
        status: 'sent',
      })
      return { ok: true, status: 'queued', messageId }
    } catch (e: any) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: opts.templateName,
        recipient_email: recipient,
        status: 'failed',
        error_message: String(e?.message || e).slice(0, 1000),
      }).then(() => {}, () => {})
    }
  }

  const { error: enqueueErr } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload,
  })
  if (enqueueErr) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: enqueueErr.message,
    })
    return { ok: false, status: 'error', error: enqueueErr.message, messageId }
  }
  return { ok: true, status: 'queued', messageId }
}