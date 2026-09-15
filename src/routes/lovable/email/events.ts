import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

async function recordEvent(
  event: { event_id: string; data: { recipient: string; message_id: string } },
  reason: 'bounce' | 'complaint' | 'unsubscribe',
) {
  const email = event.data.recipient.trim().toLowerCase()
  const status = reason === 'bounce' ? 'bounced' : reason === 'complaint' ? 'complained' : 'suppressed'
  const errorMessage = reason === 'bounce'
    ? 'Permanent bounce — email address is invalid or rejected'
    : reason === 'complaint'
      ? 'Spam complaint — recipient marked email as spam'
      : 'Recipient unsubscribed'

  const { error: suppressionError } = await supabaseAdmin
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (suppressionError) {
    console.error('Failed to record email suppression', { event_id: event.event_id, code: suppressionError.code, message: suppressionError.message })
    throw suppressionError
  }

  const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
    message_id: event.data.message_id || null,
    template_name: 'system',
    recipient_email: email,
    status,
    error_message: errorMessage,
    metadata: null,
  })
  if (logError) {
    console.error('Failed to record email event', { event_id: event.event_id, code: logError.code, message: logError.message })
    throw logError
  }

  if (reason === 'unsubscribe') {
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        email_marketing_opt_in: false,
        marketing_consent_at: new Date().toISOString(),
        marketing_consent_source: 'unsubscribe_link',
      })
      .ilike('real_email', email)
    if (profileError) {
      console.error('Failed to record marketing opt-out', { event_id: event.event_id, code: profileError.code, message: profileError.message })
      throw profileError
    }
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await recordEvent(event, 'bounce')
            },
            'email.complaint': async (event) => {
              await recordEvent(event, 'complaint')
            },
            'email.unsubscribed': async (event) => {
              await recordEvent(event, 'unsubscribe')
            },
          },
        })
        return handler(request)
      },
    },
  },
})
