import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type DeviceInfo = {
  userId: string
  label: 'Android App' | 'iOS PWA' | 'iOS Web' | 'Android Web' | 'Web'
  version: string | null
  lastSeenAt: string | null
}

function classify(platform: string | null, ua: string | null, appVersion: string | null): { label: DeviceInfo['label']; version: string | null } {
  const u = (ua || '').toLowerCase()
  const isWebView = /\bwv\b/.test(u) || / version\/\d[\d.]* chrome\//.test(u) && /android/.test(u) && /\bwv\b/.test(u)
  const isIOS = /iphone|ipad|ipod/.test(u) || /mac os x/.test(u) && /mobile/.test(u)
  const isAndroid = /android/.test(u) || platform === 'android'

  // Native Android APK reports platform='android' AND contains 'wv' in UA.
  if (platform === 'android' && /\bwv\b/.test(u)) {
    return { label: 'Android App', version: appVersion || null }
  }
  if (isIOS) {
    // iOS PWA runs in standalone mode; UA alone can't tell. Treat mobile Safari as iOS PWA candidate.
    return { label: 'iOS PWA', version: null }
  }
  if (isAndroid) {
    return { label: 'Android Web', version: null }
  }
  return { label: 'Web', version: null }
}

/** Master-admin only: latest device per user based on last_seen_at in user_sessions. */
export const getLatestDevices = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userIds: z.array(z.string().uuid()).max(2000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Verify admin.
    const { data: prof } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_master_admin')
      .eq('id', context.userId)
      .maybeSingle()
    const allowed = !!prof && (prof.is_master_admin || prof.role === 'admin' || prof.role === 'master_admin')
    if (!allowed) throw new Error('Forbidden')

    let q = supabaseAdmin
      .from('user_sessions')
      .select('user_id, platform, user_agent, app_version, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(5000)
    if (data.userIds && data.userIds.length) q = q.in('user_id', data.userIds)

    const { data: rows, error } = await q
    if (error) throw new Error(error.message)

    const map = new Map<string, DeviceInfo>()
    for (const r of rows || []) {
      if (map.has(r.user_id)) continue // rows already ordered desc; keep first
      const c = classify(r.platform, r.user_agent, r.app_version)
      map.set(r.user_id, {
        userId: r.user_id,
        label: c.label,
        version: c.version,
        lastSeenAt: r.last_seen_at,
      })
    }
    return Array.from(map.values())
  })