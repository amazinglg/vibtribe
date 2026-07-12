import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Deletes the caller's own account (logs the reason + emails a "sad to see
 * you go" message before the profile row is wiped).
 */
export const selfDeleteAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reasonKey: z.string().trim().min(1).max(64),
        reasonLabel: z.string().trim().min(1).max(200),
        reasonText: z.string().trim().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const uid = context.userId

    // Snapshot recipient info while the profile still exists
    const { data: prof } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, real_email, email')
      .eq('id', uid)
      .maybeSingle()
    const recipient =
      (prof as any)?.real_email || (prof as any)?.email || null
    const fullName = (prof as any)?.full_name || null

    // Send the "sad to see you go" email BEFORE deletion; failure is non-fatal.
    if (recipient) {
      try {
        const { enqueueTransactionalEmail } = await import('@/lib/email-enqueue.server')
        await enqueueTransactionalEmail({
          templateName: 'sad-to-see-you-go',
          recipientEmail: recipient,
          idempotencyKey: `self-delete-${uid}`,
          templateData: {
            name: fullName || undefined,
            reasonLabel: data.reasonLabel,
            reasonText: data.reasonText || undefined,
          },
        })
      } catch (e) {
        console.error('[selfDeleteAccount] farewell email failed', e)
      }
    }

    // Perform the delete. RPC uses auth.uid() from the caller's JWT; we call
    // through the user-authenticated Supabase client on `context` so RLS +
    // auth.uid() are honoured, and the reason is written to deleted_users_log.
    const { error } = await (context.supabase as any).rpc('delete_my_account', {
      _reason_key: data.reasonKey,
      _reason_text: data.reasonText ?? null,
    })
    if (error) throw new Error(error.message)

    return { ok: true }
  })