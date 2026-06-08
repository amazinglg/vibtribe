import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

function hashIp(ip: string): string {
  // Simple non-reversible hash for analytics-only IP de-dupe.
  let h = 0
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(36)}`
}

export const Route = createFileRoute('/api/public/track-apk-download')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = (request.headers.get('user-agent') || '').slice(0, 500)
          const ref = (request.headers.get('referer') || '').slice(0, 500)
          const ip = (request.headers.get('cf-connecting-ip')
            || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || 'unknown').slice(0, 64)
          await supabaseAdmin.from('apk_download_events').insert({
            ip_hash: hashIp(ip),
            user_agent: ua,
            referrer: ref,
          })
        } catch (e) {
          console.error('[track-apk-download]', e)
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})