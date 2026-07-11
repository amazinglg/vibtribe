import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const BUCKET = 'moderation-evidence'

const ReportTypeEnum = z.enum(['message', 'image', 'video', 'file', 'audio', 'profile', 'chat', 'status', 'tribe'])
const ReasonEnum = z.enum([
  'child_safety', 'nudity_sexual', 'harassment_bullying', 'hate_speech', 'violence', 'spam',
  'scam_fraud', 'fake_profile', 'impersonation', 'terrorism', 'illegal_activity',
  'self_harm', 'privacy_violation', 'copyright', 'other',
])

const SnapshotSchema = z
  .object({
    text: z.string().max(20_000).optional(),
    messageType: z.string().optional(),
    createdAt: z.string().optional(),
    profile: z
      .object({
        id: z.string().optional(),
        full_name: z.string().optional(),
        username: z.string().optional(),
        avatar_url: z.string().optional().nullable(),
      })
      .optional(),
    chatMeta: z
      .object({ id: z.string().optional(), name: z.string().optional(), type: z.string().optional() })
      .optional(),
    status: z
      .object({
        id: z.string().optional(),
        content: z.string().optional(),
        media_type: z.string().optional(),
        background_color: z.string().optional(),
      })
      .optional(),
    /** base64-encoded media bytes (already-decrypted plaintext) — capped at ~10MB */
    mediaBase64: z.string().max(15_000_000).optional(),
    mediaMime: z.string().max(120).optional(),
    mediaName: z.string().max(300).optional(),
  })
  .default({})

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function extForMime(mime: string | undefined, fallback = 'bin'): string {
  if (!mime) return fallback
  const m = mime.toLowerCase()
  if (m.includes('jpeg')) return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('webm')) return 'webm'
  if (m.includes('quicktime')) return 'mov'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('pdf')) return 'pdf'
  return fallback
}

/** Submit a new content report. Uploads any decrypted media evidence to a private bucket. */
export const submitReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reportType: ReportTypeEnum,
        reason: ReasonEnum,
        comments: z.string().trim().max(2000).optional(),
        reportedUserId: z.string().uuid().optional(),
        chatId: z.string().uuid().optional(),
        messageId: z.string().uuid().optional(),
        statusId: z.string().uuid().optional(),
        targetRef: z.string().max(500).optional(),
        snapshot: SnapshotSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context

    // Insert report first so we have an id to key the evidence path.
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('content_reports')
      .insert({
        reporter_id: userId,
        reported_user_id: data.reportedUserId ?? null,
        report_type: data.reportType,
        reason: data.reason,
        comments: data.comments ?? null,
        chat_id: data.chatId ?? null,
        message_id: data.messageId ?? null,
        status_id: data.statusId ?? null,
        target_ref: data.targetRef ?? null,
        snapshot: {
          text: data.snapshot.text ?? null,
          messageType: data.snapshot.messageType ?? null,
          createdAt: data.snapshot.createdAt ?? null,
          profile: data.snapshot.profile ?? null,
          chatMeta: data.snapshot.chatMeta ?? null,
          status: data.snapshot.status ?? null,
          media: null,
        },
      })
      .select('id')
      .single()

    if (insErr || !inserted) throw new Error(insErr?.message || 'Could not create report')
    const reportId: string = inserted.id

    // If evidence media was provided, decode and store it under the report id.
    if (data.snapshot.mediaBase64) {
      try {
        const bytes = b64ToBytes(data.snapshot.mediaBase64)
        const ext = extForMime(data.snapshot.mediaMime, data.snapshot.mediaName?.split('.').pop() || 'bin')
        const path = `${reportId}/evidence.${ext}`
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, bytes, {
            contentType: data.snapshot.mediaMime || 'application/octet-stream',
            upsert: true,
          })
        if (upErr) throw upErr

        // Merge media metadata into the snapshot.
        const media = {
          path,
          mime: data.snapshot.mediaMime || 'application/octet-stream',
          name: data.snapshot.mediaName || `evidence.${ext}`,
          size: bytes.byteLength,
        }
        await supabaseAdmin
          .from('content_reports')
          .update({
            snapshot: {
              text: data.snapshot.text ?? null,
              messageType: data.snapshot.messageType ?? null,
              createdAt: data.snapshot.createdAt ?? null,
              profile: data.snapshot.profile ?? null,
              chatMeta: data.snapshot.chatMeta ?? null,
              status: data.snapshot.status ?? null,
              media,
            },
          })
          .eq('id', reportId)
      } catch (e: any) {
        console.warn('[reports] media upload failed', e?.message || e)
      }
    }

    return { id: reportId }
  })

/** Master-admin: fetch a short-lived signed URL for a piece of evidence media. */
export const getEvidenceSignedUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await supabaseAdmin.rpc('has_permission', {
      _user_id: context.userId,
      _permission_key: 'reports.view',
    })
    const { data: manageAllowed } = await supabaseAdmin.rpc('has_permission', {
      _user_id: context.userId,
      _permission_key: 'reports.manage',
    })
    if (!allowed && !manageAllowed) throw new Error('Forbidden')

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 60 * 10) // 10 min
    if (error || !signed) throw new Error(error?.message || 'Could not sign URL')
    return { url: signed.signedUrl }
  })

/** Master-admin: record a moderation decision + write an audit-log row. */
export const moderateReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reportId: z.string().uuid(),
        status: z.enum(['true_positive', 'false_positive', 'dismissed']),
        notes: z.string().trim().max(4000).optional(),
        action: z.enum(['none', 'delete_content', 'suspend_user', 'ban_user', 'dismiss']).default('none'),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await supabaseAdmin
      .from('user_profiles')
      .select('is_master_admin, full_name, username')
      .eq('id', context.userId)
      .single()
    const { data: allowed } = await supabaseAdmin.rpc('has_permission', {
      _user_id: context.userId,
      _permission_key: 'reports.manage',
    })
    if (!allowed) throw new Error('Forbidden')

    const { error: updErr } = await supabaseAdmin
      .from('content_reports')
      .update({
        status: data.status,
        moderator_id: context.userId,
        moderator_notes: data.notes ?? null,
        moderated_at: new Date().toISOString(),
        action_taken: data.action,
      })
      .eq('id', data.reportId)
    if (updErr) throw updErr

    await supabaseAdmin.from('moderation_audit_log').insert({
      report_id: data.reportId,
      moderator_id: context.userId,
      moderator_name: prof?.full_name || prof?.username || 'Moderator',
      action: `${data.status}:${data.action}`,
      notes: data.notes ?? null,
    })

    // Fetch the report so we can notify the reporter (and the reported user when an
    // enforcement action was taken).
    const { data: report } = await supabaseAdmin
      .from('content_reports')
      .select('reporter_id, reported_user_id, report_type, reason')
      .eq('id', data.reportId)
      .single()

    // Notify the reporter about the outcome.
    if (report?.reporter_id) {
      const outcomeLabel =
        data.status === 'true_positive'
          ? 'Action taken'
          : data.status === 'false_positive'
            ? 'No violation found'
            : 'Report closed'
      const actionLabel = {
        none: 'Report reviewed — no further action needed.',
        delete_content: 'The reported content has been removed.',
        suspend_user: 'The reported account has been suspended.',
        ban_user: 'The reported account has been permanently banned.',
        dismiss: 'Your report was reviewed and closed.',
      }[data.action]
      await supabaseAdmin.from('notifications').insert({
        user_id: report.reporter_id,
        type: 'report_reviewed',
        title: `Report reviewed: ${outcomeLabel}`,
        body: `${actionLabel} Thank you for helping keep VibTribe safe.`,
        link: '/help/reporting',
      })
    }

    // If action affects the reported user, apply it.
    if (data.action === 'suspend_user' || data.action === 'ban_user') {
      if (report?.reported_user_id) {
        await supabaseAdmin
          .from('user_profiles')
          .update({
            is_suspended: true,
            account_status: 'suspended' as const,
          } as any)
          .eq('id', report.reported_user_id)

        // Let the reported user know their account was actioned, and provide an
        // appeal link keyed to this report.
        await supabaseAdmin.from('notifications').insert({
          user_id: report.reported_user_id,
          type: 'moderation_action',
          title: data.action === 'ban_user' ? 'Your account has been banned' : 'Your account has been suspended',
          body: 'A moderator has taken action on your account for a Community Guidelines violation. You can appeal this decision if you believe it was made in error.',
          link: `/appeal/${data.reportId}`,
        })
      }
    }

    return { ok: true }
  })
