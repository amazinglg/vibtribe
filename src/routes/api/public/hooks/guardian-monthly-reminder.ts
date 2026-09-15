import { createFileRoute } from '@tanstack/react-router'
import { enqueueTransactionalEmail } from '@/lib/email-enqueue.server'

/**
 * DPDP-aligned monthly guardian reminder.
 *
 * Triggered by pg_cron on the 1st of every month at 06:30 UTC. For every
 * active guardian consent whose last reminder is >28 days old, we send a
 * fresh "consent still active" email with the /guardian-consent/:token link
 * (which they can also use to withdraw consent).
 */

const SITE_ORIGIN = 'https://www.vibtribe.in'

export const Route = createFileRoute('/api/public/hooks/guardian-monthly-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return new Response('Server misconfigured', { status: 500 })
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
        if (!authHeader.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 })
        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== serviceKey) return new Response('Forbidden', { status: 403 })
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: due, error } = await supabaseAdmin.rpc('guardian_reminders_due' as any)
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

        const summary = { sent: 0, skipped: 0, errors: [] as string[] }
        for (const row of (due ?? []) as any[]) {
          try {
            const consentUrl = `${SITE_ORIGIN}/guardian-consent/${row.consent_token}`
            const idem = `guardian-reminder-${row.id}-${new Date().toISOString().slice(0, 7)}`
            const result = await enqueueTransactionalEmail({
              templateName: 'guardian-consent-request',
              recipientEmail: row.guardian_email,
              idempotencyKey: idem,
              templateData: {
                consentUrl,
                minorName: row.minor_full_name,
                guardianName: row.guardian_name,
                relationship: 'guardian',
              },
            })
            if (!result.ok && result.status !== 'suppressed') { summary.errors.push(result.error || 'Email send failed'); continue }
            await supabaseAdmin.rpc('mark_guardian_reminded' as any, { _id: row.id })
            summary.sent++
          } catch (e: any) {
            summary.errors.push(e?.message || 'unknown')
          }
        }
        return Response.json({ ok: true, ...summary, ranAt: new Date().toISOString() })
      },
    },
  },
})