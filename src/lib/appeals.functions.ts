import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

/** User submits an appeal against a moderation decision that affected them. */
export const submitAppeal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reportId: z.string().uuid(),
        reason: z.string().trim().min(10).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Only the reported user (or, if none, the reporter) may appeal.
    const { data: report, error: repErr } = await supabaseAdmin
      .from('content_reports')
      .select('id, reporter_id, reported_user_id, status, action_taken')
      .eq('id', data.reportId)
      .single()
    if (repErr || !report) throw new Error('Report not found')

    const isAffected =
      report.reported_user_id === context.userId || report.reporter_id === context.userId
    if (!isAffected) throw new Error('You cannot appeal this decision')
    if (!report.status || report.status === 'pending') {
      throw new Error('This report has not been reviewed yet')
    }

    // Prevent duplicate pending appeals.
    const { data: existing } = await supabaseAdmin
      .from('report_appeals' as any)
      .select('id, status')
      .eq('report_id', data.reportId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) throw new Error('You already have a pending appeal for this decision')

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('report_appeals' as any)
      .insert({
        report_id: data.reportId,
        appellant_id: context.userId,
        reason: data.reason,
      })
      .select('id')
      .single()
    if (insErr || !inserted) throw new Error(insErr?.message || 'Could not submit appeal')

    return { id: (inserted as any).id }
  })

/** Master admin reviews an appeal (approve reverses the enforcement, reject upholds it). */
export const reviewAppeal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appealId: z.string().uuid(),
        decision: z.enum(['approved', 'rejected']),
        notes: z.string().trim().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await supabaseAdmin
      .from('user_profiles')
      .select('is_master_admin')
      .eq('id', context.userId)
      .single()
    if (!prof?.is_master_admin) throw new Error('Forbidden')

    const { data: appeal, error: aErr } = await supabaseAdmin
      .from('report_appeals' as any)
      .select('id, report_id, appellant_id, status')
      .eq('id', data.appealId)
      .single()
    if (aErr || !appeal) throw new Error('Appeal not found')
    if ((appeal as any).status !== 'pending') throw new Error('This appeal has already been reviewed')

    const { error: updErr } = await supabaseAdmin
      .from('report_appeals' as any)
      .update({
        status: data.decision,
        reviewer_id: context.userId,
        reviewer_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', data.appealId)
    if (updErr) throw updErr

    // Approving an appeal reverses account-level enforcement for the reported user.
    if (data.decision === 'approved') {
      const { data: rep } = await supabaseAdmin
        .from('content_reports')
        .select('reported_user_id, action_taken')
        .eq('id', (appeal as any).report_id)
        .single()
      if (
        rep?.reported_user_id &&
        (rep.action_taken === 'suspend_user' || rep.action_taken === 'ban_user')
      ) {
        await supabaseAdmin
          .from('user_profiles')
          .update({ is_suspended: false, account_status: 'active' } as any)
          .eq('id', rep.reported_user_id)
      }
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: (appeal as any).appellant_id,
      type: 'appeal_reviewed',
      title: data.decision === 'approved' ? 'Your appeal was approved' : 'Your appeal was rejected',
      body:
        data.decision === 'approved'
          ? 'A moderator reviewed your appeal and reversed the earlier decision.'
          : 'A moderator reviewed your appeal and upheld the earlier decision.',
      link: '/help/reporting',
    })

    return { ok: true }
  })