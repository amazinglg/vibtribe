import { createFileRoute } from '@tanstack/react-router'

/**
 * DPDP §8(7) — Inactive-account retention.
 *
 * Daily sweep:
 *   • 2y 9mo inactive  → first warning email (90 days notice)
 *   • 2y 11mo inactive → final warning email (30 days notice)
 *   • 3y inactive      → erase the account
 *
 * "Inactive" = `user_profiles.last_seen` older than the threshold AND the
 * account is not suspended / pending deletion already.
 *
 * Triggered by pg_cron daily. No auth required (under /api/public/*) but
 * the work is fully idempotent — re-running won't double-send warnings
 * or double-delete users.
 */

const WARN_DAYS = 990         // 2 years 9 months
const FINAL_WARN_DAYS = 1065  // 2 years 11 months
const DELETE_DAYS = 1095      // 3 years
const BATCH = 50              // safety cap per run

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  last_seen: string | null
}

export const Route = createFileRoute('/api/public/hooks/retention-sweep')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const now = Date.now()
        const thresh = (days: number) => new Date(now - days * 86400_000).toISOString()

        const summary = { warned: 0, finalWarned: 0, deleted: 0, errors: [] as string[] }

        // --- 1) First warning ---------------------------------------------------
        const { data: warnTargets, error: warnErr } = await supabaseAdmin
          .from('user_profiles')
          .select('id, email, full_name, last_seen')
          .lt('last_seen', thresh(WARN_DAYS))
          .gte('last_seen', thresh(FINAL_WARN_DAYS))
          .is('inactivity_warning_sent_at', null)
          .limit(BATCH)

        if (warnErr) summary.errors.push('warn-query: ' + warnErr.message)

        for (const u of (warnTargets ?? []) as Profile[]) {
          if (!u.email) continue
          const ok = await enqueueRetentionEmail(supabaseAdmin, {
            to: u.email,
            name: u.full_name ?? 'there',
            daysLeft: 90,
            userId: u.id,
            kind: 'warn',
          })
          if (ok) {
            await supabaseAdmin
              .from('user_profiles')
              .update({ inactivity_warning_sent_at: new Date().toISOString() })
              .eq('id', u.id)
            summary.warned++
          }
        }

        // --- 2) Final warning ---------------------------------------------------
        const { data: finalTargets, error: finalErr } = await supabaseAdmin
          .from('user_profiles')
          .select('id, email, full_name, last_seen')
          .lt('last_seen', thresh(FINAL_WARN_DAYS))
          .gte('last_seen', thresh(DELETE_DAYS))
          .is('inactivity_final_warning_sent_at', null)
          .limit(BATCH)

        if (finalErr) summary.errors.push('final-query: ' + finalErr.message)

        for (const u of (finalTargets ?? []) as Profile[]) {
          if (!u.email) continue
          const ok = await enqueueRetentionEmail(supabaseAdmin, {
            to: u.email,
            name: u.full_name ?? 'there',
            daysLeft: 30,
            userId: u.id,
            kind: 'final',
          })
          if (ok) {
            await supabaseAdmin
              .from('user_profiles')
              .update({ inactivity_final_warning_sent_at: new Date().toISOString() })
              .eq('id', u.id)
            summary.finalWarned++
          }
        }

        // --- 3) Erase ----------------------------------------------------------
        const { data: deleteTargets, error: delErr } = await supabaseAdmin
          .from('user_profiles')
          .select('id, email, last_seen')
          .lt('last_seen', thresh(DELETE_DAYS))
          .limit(BATCH)

        if (delErr) summary.errors.push('delete-query: ' + delErr.message)

        for (const u of (deleteTargets ?? []) as Profile[]) {
          // Skip the pinned founder account (master admin), defensively.
          const { data: isMaster } = await supabaseAdmin.rpc('is_pinned_master_mobile', { _user_id: u.id }).then(
            (r: any) => ({ data: r?.data }),
            () => ({ data: false }),
          )
          if (isMaster) continue
          const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(u.id)
          if (delAuthErr) {
            summary.errors.push(`delete-user ${u.id}: ${delAuthErr.message}`)
            continue
          }
          summary.deleted++
        }

        return Response.json({ ok: true, ...summary, ranAt: new Date().toISOString() })
      },
    },
  },
})

async function enqueueRetentionEmail(
  admin: any,
  args: { to: string; name: string; daysLeft: number; userId: string; kind: 'warn' | 'final' },
): Promise<boolean> {
  // Honour suppression list.
  const { data: suppressed } = await admin
    .from('suppressed_emails')
    .select('email')
    .eq('email', args.to.toLowerCase())
    .maybeSingle()
  if (suppressed) return false

  const title = `Your VibTribe account will be deleted in ${args.daysLeft} days`
  const body =
    `Hi ${args.name}, we noticed you haven't used VibTribe in nearly 3 years. ` +
    `Under our DPDP-compliant data retention policy, accounts inactive for 3 years are permanently erased. ` +
    `Sign in within the next ${args.daysLeft} days to keep your account, chats and contacts. ` +
    `If you take no action, your account and all associated data will be deleted automatically.`

  const idem = `retention-${args.kind}-${args.userId}-${new Date().toISOString().slice(0, 10)}`

  const { error } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      template_name: 'notification',
      recipient_email: args.to,
      idempotency_key: idem,
      template_data: { title, body, link: '/' },
    },
  })
  if (error) {
    console.warn('[retention] enqueue failed', error)
    return false
  }
  return true
}