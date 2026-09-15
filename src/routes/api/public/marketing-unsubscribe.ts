import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const tokenSchema = z.string().min(32).max(256)

async function getToken(request: Request): Promise<string | null> {
  const urlToken = new URL(request.url).searchParams.get('token')
  if (urlToken) return tokenSchema.safeParse(urlToken).data ?? null

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text())
    return tokenSchema.safeParse(form.get('token')).data ?? null
  }

  try {
    const body = z.object({ token: tokenSchema }).parse(await request.json())
    return body.token
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/public/marketing-unsubscribe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = await getToken(request)
        if (!token) return Response.json({ error: 'Invalid link' }, { status: 400 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data, error } = await supabaseAdmin
          .from('email_unsubscribe_tokens')
          .select('email, used_at')
          .eq('token', token)
          .maybeSingle()

        if (error || !data) return Response.json({ error: 'Invalid or expired link' }, { status: 404 })
        return Response.json({ email: data.email, used: Boolean(data.used_at) })
      },

      POST: async ({ request }) => {
        const token = await getToken(request)
        if (!token) return Response.json({ error: 'Invalid link' }, { status: 400 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: tokenRecord, error: lookupError } = await supabaseAdmin
          .from('email_unsubscribe_tokens')
          .select('email, used_at')
          .eq('token', token)
          .maybeSingle()

        if (lookupError || !tokenRecord) {
          return Response.json({ error: 'Invalid or expired link' }, { status: 404 })
        }
        if (tokenRecord.used_at) return Response.json({ success: true, alreadyUnsubscribed: true })

        const now = new Date().toISOString()
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('email_unsubscribe_tokens')
          .update({ used_at: now })
          .eq('token', token)
          .is('used_at', null)
          .select('email')
          .maybeSingle()

        if (updateError) return Response.json({ error: 'Unable to update preferences' }, { status: 500 })
        if (!updated) return Response.json({ success: true, alreadyUnsubscribed: true })

        const email = updated.email.trim().toLowerCase()
        const { error: suppressionError } = await supabaseAdmin
          .from('suppressed_emails')
          .upsert({ email, reason: 'unsubscribe' }, { onConflict: 'email' })
        if (suppressionError) return Response.json({ error: 'Unable to update preferences' }, { status: 500 })

        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            email_marketing_opt_in: false,
            marketing_consent_at: now,
            marketing_consent_source: 'unsubscribe_link',
          })
          .ilike('real_email', email)
        if (profileError) return Response.json({ error: 'Unable to update preferences' }, { status: 500 })

        return Response.json({ success: true })
      },
    },
  },
})