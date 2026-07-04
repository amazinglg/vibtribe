import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// Cron-invoked endpoint (pg_cron, hourly). Sends reminder emails to users who
// verified their email but never completed onboarding. The DB helper
// `list_pending_signup_reminders` enforces the reminder schedule
// (24h / +72h / +7d, max 3 reminders) so this handler only needs to enqueue
// the email and mark the reminder as sent.
export const Route = createFileRoute('/api/public/hooks/incomplete-signup-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return new Response('Server misconfigured', { status: 500 })
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
        if (!authHeader.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 })
        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== serviceKey) return new Response('Forbidden', { status: 403 })

        const { enqueueTransactionalEmail } = await import('@/lib/email-enqueue.server')

        const { data: pending, error } = await supabaseAdmin.rpc(
          'list_pending_signup_reminders' as any,
          { _limit: 200 },
        )
        if (error) {
          console.error('[incomplete-signup-reminders] list error', error)
          return Response.json({ ok: false, error: error.message }, { status: 500 })
        }
        const rows = (pending || []) as Array<{
          user_id: string
          email: string
          full_name: string | null
          reminders_sent: number
        }>

        let sent = 0
        let skipped = 0
        let failed = 0
        for (const row of rows) {
          const reminderNumber = Math.min(3, (row.reminders_sent || 0) + 1)
          const res = await enqueueTransactionalEmail({
            templateName: 'incomplete-signup-reminder',
            recipientEmail: row.email,
            idempotencyKey: `signup-reminder-${row.user_id}-${reminderNumber}`,
            templateData: {
              name: row.full_name || undefined,
              reminderNumber,
            },
          })
          if (res.ok || res.status === 'suppressed') {
            // Advance counter even on suppression so we don't loop forever.
            const { error: markErr } = await supabaseAdmin.rpc(
              'mark_signup_reminder_sent' as any,
              { _user_id: row.user_id },
            )
            if (markErr) {
              console.error('[incomplete-signup-reminders] mark failed', markErr)
              failed++
            } else if (res.ok) sent++
            else skipped++
          } else {
            failed++
            console.error('[incomplete-signup-reminders] enqueue failed', res)
          }
        }

        return Response.json({ ok: true, considered: rows.length, sent, skipped, failed })
      },
      GET: async () => Response.json({ ok: true, hint: 'POST with service-role bearer to run reminders' }),
    },
  },
})