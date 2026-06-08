import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// Cron-invoked endpoint (pg_cron, every 15 min). Deletes status-media files
// for expired statuses, then removes the rows themselves.
export const Route = createFileRoute('/api/public/hooks/cleanup-expired-statuses')({
  server: {
    handlers: {
      POST: async () => {
        let removedFiles = 0
        let removedRows = 0
        try {
          const { data: expired } = await supabaseAdmin
            .from('statuses')
            .select('id, media_url')
            .lt('expires_at', new Date().toISOString())
            .limit(500)

          const rows = expired || []
          if (rows.length === 0) {
            return Response.json({ ok: true, removedFiles: 0, removedRows: 0 })
          }

          const paths: string[] = []
          for (const r of rows) {
            if (r.media_url) {
              const marker = '/status-media/'
              const idx = r.media_url.indexOf(marker)
              if (idx >= 0) paths.push(decodeURIComponent(r.media_url.slice(idx + marker.length).split('?')[0]))
            }
          }
          if (paths.length) {
            const { error: rmErr } = await supabaseAdmin.storage.from('status-media').remove(paths)
            if (!rmErr) removedFiles = paths.length
          }

          const ids = rows.map(r => r.id)
          const { error: delErr } = await supabaseAdmin.from('statuses').delete().in('id', ids)
          if (!delErr) removedRows = ids.length
        } catch (e: any) {
          console.error('[cleanup-expired-statuses]', e)
          return new Response(JSON.stringify({ ok: false, error: e?.message || 'failed' }), {
            status: 500, headers: { 'content-type': 'application/json' },
          })
        }
        return Response.json({ ok: true, removedFiles, removedRows })
      },
      GET: async () => Response.json({ ok: true, hint: 'POST to run cleanup' }),
    },
  },
})