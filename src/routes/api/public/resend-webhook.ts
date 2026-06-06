import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

// Resend signs webhooks using Svix. We verify the signature when the
// RESEND_WEBHOOK_SECRET is set; otherwise (development) we accept but log.
async function verifySvix(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')
  if (!id || !timestamp || !signature) return false
  // Svix secret format: "whsec_<base64>"
  const secretBytes = secret.startsWith('whsec_')
    ? Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0))
    : new TextEncoder().encode(secret)
  const toSign = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)
  const key = await crypto.subtle.importKey(
    'raw', secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, toSign))
  const expected = btoa(String.fromCharCode(...sigBytes))
  // signature header is space-separated "v1,<sig> v1,<sig2> ..."
  return signature.split(' ').some(s => {
    const [, sig] = s.split(',')
    return sig === expected
  })
}

export const Route = createFileRoute('/api/public/resend-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) return new Response('Server misconfigured', { status: 500 })
        const supabase = createClient(url, key, { auth: { persistSession: false } })

        const rawBody = await request.text()
        const secret = process.env.RESEND_WEBHOOK_SECRET
        if (!secret) {
          console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured; refusing request')
          return new Response('Webhook secret not configured', { status: 500 })
        }
        const ok = await verifySvix(rawBody, request.headers, secret).catch(() => false)
        if (!ok) return new Response('Invalid signature', { status: 401 })

        let payload: any
        try { payload = JSON.parse(rawBody) } catch { return new Response('Bad JSON', { status: 400 }) }

        const eventType: string = payload?.type || ''
        const email: string | undefined = (
          payload?.data?.to?.[0] || payload?.data?.email || payload?.data?.recipient
        )?.toString().toLowerCase()
        const messageId: string | undefined = payload?.data?.email_id || payload?.data?.id

        if (!email) return Response.json({ ok: true, ignored: 'no email' })

        // Bounces / complaints → suppress + opt out
        if (eventType === 'email.bounced' || eventType === 'email.complained') {
          const reason = eventType === 'email.bounced' ? 'bounce' : 'complaint'
          await supabase.from('suppressed_emails').upsert(
            { email, reason, metadata: payload?.data ?? null },
            { onConflict: 'email' },
          )
          await supabase
            .from('user_profiles')
            .update({
              email_marketing_opt_in: false,
              marketing_consent_source: reason === 'bounce' ? 'bounce_auto' : 'complaint_auto',
            })
            .ilike('real_email', email)
          if (messageId) {
            await supabase
              .from('email_campaign_recipients')
              .update({ status: 'failed', error_message: reason })
              .eq('resend_message_id', messageId)
          }
        }

        return Response.json({ ok: true })
      },
    },
  },
})