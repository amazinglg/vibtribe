import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { render } from '@react-email/components'
import { template as guardianConsentRequestTemplate } from '@/lib/email-templates/guardian-consent-request'

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
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: due, error } = await supabaseAdmin.rpc('guardian_reminders_due' as any)
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

        const summary = { sent: 0, skipped: 0, errors: [] as string[] }
        for (const row of (due ?? []) as any[]) {
          try {
            const consentUrl = `${SITE_ORIGIN}/guardian-consent/${row.consent_token}`
            const el = React.createElement(guardianConsentRequestTemplate.component, {
              consentUrl,
              minorName: row.minor_full_name,
              guardianName: row.guardian_name,
              relationship: 'guardian',
            })
            const html = await render(el)
            const text = await render(el, { plainText: true })
            const subject = `Monthly reminder: consent still active for ${row.minor_full_name}`

            const idem = `guardian-reminder-${row.id}-${new Date().toISOString().slice(0, 7)}`
            const { error: qErr } = await supabaseAdmin.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: crypto.randomUUID(),
                to: row.guardian_email,
                from: 'VibTribe <noreply@www.vibtribe.in>',
                sender_domain: 'notify.www.vibtribe.in',
                subject,
                html,
                text,
                purpose: 'transactional',
                label: 'guardian_monthly_reminder',
                idempotency_key: idem,
                queued_at: new Date().toISOString(),
              },
            })
            if (qErr) { summary.errors.push(qErr.message); continue }
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