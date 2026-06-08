import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Admin-only: publish a new release marker. Connected clients listen on
 * the `app_releases` realtime channel and hard-reload (clearing caches +
 * unregistering the service worker) without signing the user out.
 */
export const publishAppRelease = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      version: z.string().min(1).max(64).optional(),
      note: z.string().max(280).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Verify caller is admin / master admin
    const { data: actor } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_master_admin')
      .eq('id', context.userId)
      .maybeSingle()
    if (!actor || (actor.role !== 'admin' && actor.role !== 'master_admin' && !actor.is_master_admin)) {
      throw new Error('Admin access required')
    }

    const version = data.version || `r-${Date.now()}`
    const { data: row, error } = await supabaseAdmin
      .from('app_releases')
      .insert({ version, note: data.note ?? null, released_by: context.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { release: row }
  })