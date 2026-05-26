import * as React from 'react'
import { render } from '@react-email/components'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { template as ticketReplyTpl } from '@/lib/email-templates/ticket-reply'

const SITE_NAME = 'vibtribe'
const SENDER_DOMAIN = 'notify.www.vibtribe.in'
const FROM_DOMAIN = 'www.vibtribe.in'

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

export const replyToTicket = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      ticketId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { data: actor } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_master_admin, full_name')
      .eq('id', userId)
      .maybeSingle()
    if (!actor || (actor.role !== 'admin' && !actor.is_master_admin)) {
      throw new Error('Admin access required')
    }

    const { data: ticket, error: tErr } = await supabaseAdmin
      .from('support_tickets')
      .select('id, email, name, issue_title, issue_description, user_id')
      .eq('id', data.ticketId)
      .maybeSingle()
    if (tErr || !ticket) throw new Error('Ticket not found')

    // Insert thread message
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('support_ticket_messages')
      .insert({
        ticket_id: data.ticketId,
        sender_type: 'admin',
        sender_id: userId,
        sender_name: actor.full_name || 'Support',
        body: data.body,
      })
      .select('id, created_at')
      .single()
    if (insErr) throw new Error(insErr.message)

    // Mark ticket in-process & store latest reply snapshot
    await supabaseAdmin
      .from('support_tickets')
      .update({
        admin_reply: data.body,
        replied_at: new Date().toISOString(),
        ticket_status: 'inprocess',
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.ticketId)

    // Notify user in-app (if registered)
    if (ticket.user_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: ticket.user_id,
        type: 'support_ticket',
        title: 'Support replied to your ticket',
        body: data.body.slice(0, 140),
        link: `/profile-screen?tab=tickets`,
      })
    }

    // Send email (best-effort, but surface errors)
    let emailQueued = false
    let emailError: string | null = null
    if (ticket.email) {
      try {
        // Suppression check
        const { data: suppressed } = await supabaseAdmin
          .from('suppressed_emails')
          .select('id')
          .eq('email', ticket.email.toLowerCase())
          .maybeSingle()
        if (suppressed) {
          emailError = 'Recipient unsubscribed'
        } else {
          const unsubscribeToken = await getOrCreateUnsubToken(ticket.email)
          const element = React.createElement(ticketReplyTpl.component, {
            name: ticket.name,
            ticketTitle: ticket.issue_title,
            ticketDescription: ticket.issue_description,
            reply: data.body,
          })
          const html = await render(element)
          const text = await render(element, { plainText: true })
          const subject = typeof ticketReplyTpl.subject === 'function'
            ? ticketReplyTpl.subject({ ticketTitle: ticket.issue_title })
            : ticketReplyTpl.subject
          const messageId = crypto.randomUUID()
          await supabaseAdmin.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'ticket-reply',
            recipient_email: ticket.email,
            status: 'pending',
          })
          const { error: qErr } = await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: ticket.email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: 'transactional',
              label: 'ticket-reply',
              idempotency_key: messageId,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          })
          if (qErr) emailError = qErr.message
          else emailQueued = true
        }
      } catch (e: any) {
        emailError = e?.message || 'Failed to send email'
      }
    }

    return {
      messageId: inserted.id,
      createdAt: inserted.created_at,
      emailQueued,
      emailError,
    }
  })

export const deleteTicket = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const { error } = await supabase.rpc('admin_delete_ticket', { _ticket_id: data.ticketId })
    if (error) throw new Error(error.message)
    return { ok: true }
  })