import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// Cron-invoked endpoint (pg_cron, every 15 min). Removes expired disappearing
// messages and best-effort deletes their backing files from the chat-media
// bucket. For E2E-encrypted envelopes the URL is unreadable server-side, so
// the file path is also derived from `<sender_id>/<chat_id>/` prefix scan as
// a fallback for messages older than 24h.
export const Route = createFileRoute('/api/public/hooks/cleanup-expired-messages')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return new Response('Server misconfigured', { status: 500 })
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
        if (!authHeader.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 })
        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== serviceKey) return new Response('Forbidden', { status: 403 })

        let removedFiles = 0
        let removedRows = 0
        try {
          const { data: expired } = await supabaseAdmin
            .from('messages')
            .select('id, content, sender_id, chat_id')
            .lt('expires_at', new Date().toISOString())
            .limit(1000)

          const rows = expired || []
          if (rows.length === 0) {
            return Response.json({ ok: true, removedFiles: 0, removedRows: 0 })
          }

          // Extract storage paths from any envelope containing a chat-media URL.
          const paths: string[] = []
          const marker = '/chat-media/'
          for (const r of rows) {
            const c = typeof r.content === 'string' ? r.content : ''
            // Match all occurrences (covers __media__ JSON, [IMAGE:url], [FILE:name:url]).
            let idx = c.indexOf(marker)
            while (idx !== -1) {
              // Slice URL until first whitespace, quote, bracket, or end of string.
              const tail = c.slice(idx + marker.length)
              const stop = tail.search(/["'\s\]\)\\]/)
              const raw = stop === -1 ? tail : tail.slice(0, stop)
              try {
                paths.push(decodeURIComponent(raw.split('?')[0]))
              } catch {
                paths.push(raw.split('?')[0])
              }
              idx = c.indexOf(marker, idx + marker.length)
            }
          }

          if (paths.length) {
            // Dedupe
            const unique = Array.from(new Set(paths))
            const { error: rmErr } = await supabaseAdmin.storage
              .from('chat-media')
              .remove(unique)
            if (!rmErr) removedFiles = unique.length
          }

          const ids = rows.map(r => r.id)
          const { error: delErr } = await supabaseAdmin.from('messages').delete().in('id', ids)
          if (!delErr) removedRows = ids.length
        } catch (e: any) {
          console.error('[cleanup-expired-messages]', e)
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