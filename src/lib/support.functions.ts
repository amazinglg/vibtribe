import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { enqueueTransactionalEmail } from '@/lib/email-enqueue.server'

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
          const result = await enqueueTransactionalEmail({
            templateName: 'ticket-reply',
            recipientEmail: ticket.email,
            idempotencyKey: `ticket-reply-${data.ticketId}-${inserted.id}`,
            templateData: {
            name: ticket.name,
            ticketTitle: ticket.issue_title,
            ticketDescription: ticket.issue_description,
            reply: data.body,
            },
          })
          emailQueued = result.ok
          emailError = result.error ?? (result.status === 'suppressed' ? 'Recipient suppressed' : null)
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