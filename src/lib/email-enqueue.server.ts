// Server-only compatibility helper for transactional emails from trusted
// server code. Delivery goes through Lovable's managed email service.
//
// SECURITY: This module uses the service-role Supabase client and MUST NOT be
// imported from client-reachable modules.

import { sendTemplateEmail } from './email-templates/send-email'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export interface EnqueueOpts {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

export interface EnqueueResult {
  ok: boolean
  status: 'sent' | 'suppressed' | 'unknown_template' | 'error'
  messageId?: string
  error?: string
}

export async function enqueueTransactionalEmail(
  opts: EnqueueOpts,
): Promise<EnqueueResult> {
  const recipient = opts.recipientEmail
  if (!recipient) {
    return { ok: false, status: 'error', error: 'recipientEmail is required' }
  }
  const messageId = crypto.randomUUID()
  const idempotencyKey = opts.idempotencyKey || messageId
  try {
    const result = await sendTemplateEmail(opts.templateName, recipient, {
      templateData: opts.templateData,
      idempotencyKey,
    })
    const status = result.sent ? 'sent' : 'suppressed'
    const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status,
    })
    if (logError) console.error('[email] failed to record send result', { code: logError.code, message: logError.message })
    return result.sent
      ? { ok: true, status: 'sent', messageId }
      : { ok: false, status: 'suppressed', messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
    })
    if (logError) console.error('[email] failed to record send failure', { code: logError.code, message: logError.message })
    return { ok: false, status: 'error', error: errorMessage, messageId }
  }
}