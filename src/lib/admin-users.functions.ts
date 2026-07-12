import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

async function purgeBucket(bucket: string, userId: string) {
  try {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 })
    if (error || !data?.length) return
    const paths = data.map((f) => `${userId}/${f.name}`)
    await supabaseAdmin.storage.from(bucket).remove(paths)
  } catch {}
}

export const adminDeleteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      reason: z.enum(['general', 'terms_breach', 'incomplete_signup']).default('general'),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId: actorId } = context
    // Verify actor is admin
    const { data: actor } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_master_admin')
      .eq('id', actorId)
      .maybeSingle()
    if (!actor || (actor.role !== 'admin' && actor.role !== 'master_admin' && !actor.is_master_admin)) {
      throw new Error('Admin access required')
    }

    // Look up target's contact info BEFORE deletion so we can send the
    // offboarding email. real_email is the verified inbox address.
    const { data: target } = await supabaseAdmin
      .from('user_profiles')
      .select('real_email, email, full_name')
      .eq('id', data.userId)
      .maybeSingle()
    const recipient = (target as any)?.real_email || (target as any)?.email || null
    const fullName = (target as any)?.full_name || null

    // Send offboarding email BEFORE deletion. Failure is non-fatal to deletion,
    // but returned so the admin screen can show whether the notice went out.
    let emailStatus: string | null = null
    let emailError: string | null = null
    if (recipient) {
      const templateByReason: Record<string, string> = {
        general: 'offboarding-general',
        terms_breach: 'offboarding-terms-breach',
        incomplete_signup: 'offboarding-incomplete-signup',
      }
      try {
        const { enqueueTransactionalEmail } = await import('@/lib/email-enqueue.server')
        const result = await enqueueTransactionalEmail({
          templateName: templateByReason[data.reason] || 'offboarding-general',
          recipientEmail: recipient,
          idempotencyKey: `offboarding-${data.userId}-${data.reason}`,
          templateData: { name: fullName || undefined },
        })
        emailStatus = result.status
        emailError = result.error || null
      } catch (e) {
        emailStatus = 'error'
        emailError = String((e as any)?.message || e)
        console.error('[adminDeleteUser] offboarding email enqueue failed', e)
      }
    }

    // Best-effort storage cleanup via Storage API (direct DELETE on storage.objects is blocked)
    await purgeBucket('profile-photos', data.userId)
    await purgeBucket('status-media', data.userId)

    // Delete DB rows + auth user via SECURITY DEFINER RPC
    const { error } = await supabaseAdmin.rpc('admin_delete_user', { _user_id: data.userId })
    if (error) throw new Error(error.message)

    return { ok: true, emailed: !!recipient && emailStatus !== 'error' && emailStatus !== 'suppressed', emailStatus, emailError }
  })