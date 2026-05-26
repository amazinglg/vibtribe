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
    z.object({ userId: z.string().uuid() }).parse(input),
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

    // Best-effort storage cleanup via Storage API (direct DELETE on storage.objects is blocked)
    await purgeBucket('profile-photos', data.userId)
    await purgeBucket('status-media', data.userId)

    // Delete DB rows + auth user via SECURITY DEFINER RPC
    const { error } = await supabaseAdmin.rpc('admin_delete_user', { _user_id: data.userId })
    if (error) throw new Error(error.message)

    return { ok: true }
  })