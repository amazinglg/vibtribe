import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { resendSend, wrapCampaignHtml, htmlToText } from '@/lib/marketing.server'

const OFFBOARD_DAYS = 15

function buildUnsubUrl(token: string): string {
  return `https://www.vibtribe.in/email/unsubscribe?token=${encodeURIComponent(token)}`
}

async function getOrCreateUnsubToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existing?.token && !existing.used_at) return existing.token
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const fresh = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .upsert({ token: fresh, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: stored } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()
  return stored?.token ?? fresh
}

function buildBodyHtml(name: string, deadline: Date): string {
  const dateStr = deadline.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
  const safeName = (name || 'there').replace(/[<>&"]/g, '')
  return `
    <p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Hi ${safeName},</p>
    <p style="margin:0 0 16px 0;">To keep using <strong>VibTribe</strong>, please review and accept our updated <strong>Terms &amp; Conditions</strong> and <strong>Privacy Policy</strong>.</p>
    <p style="margin:0 0 16px 0;">Re-open the VibTribe app — you'll see a one-time screen to scroll through both documents and tap <strong>Accept &amp; Continue</strong>.</p>
    <div style="margin:24px 0;padding:16px 18px;border-radius:12px;background:#fff4e5;border:1px solid #f5c98a;color:#7a4a00;">
      <p style="margin:0 0 6px 0;font-weight:700;">⚠️ Action required by ${dateStr}</p>
      <p style="margin:0;font-size:14px;line-height:1.55;">If we don't receive your acceptance within the next <strong>${OFFBOARD_DAYS} days</strong>, your VibTribe account will be <strong>offboarded</strong> and your data removed per our Privacy Policy.</p>
    </div>
    <p style="margin:24px 0 8px 0;text-align:center;"><a href="https://www.vibtribe.in/" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;">Open VibTribe &amp; Accept</a></p>
    <p style="margin:24px 0 0 0;font-size:13px;color:#6b6b6b;">Read on the web: <a href="https://www.vibtribe.in/terms" style="color:#6366f1;">Terms</a> · <a href="https://www.vibtribe.in/privacy" style="color:#6366f1;">Privacy</a></p>
  `
}

export const Route = createFileRoute('/api/public/fire-policy-reminder-once')({
  server: {
    handlers: {
      POST: async () => {
        const { data: targets, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id, full_name, real_email, terms_warning_sent_at')
          .or('terms_accepted_at.is.null,privacy_accepted_at.is.null')
          .is('terms_warning_sent_at', null)
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

        const now = new Date()
        const deadline = new Date(now.getTime() + OFFBOARD_DAYS * 86400_000)
        const { data: suppressed } = await supabaseAdmin.from('suppressed_emails').select('email')
        const supSet = new Set((suppressed ?? []).map(s => s.email.toLowerCase()))

        let notified = 0, emailed = 0, emailFailed = 0
        const failures: any[] = []

        for (const u of targets ?? []) {
          try {
            await supabaseAdmin.from('notifications').insert({
              user_id: u.id,
              type: 'policy_required',
              title: 'Action required: Accept Terms & Privacy',
              body: `Please accept VibTribe's Terms & Privacy before ${deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} or your account will be offboarded.`,
              link: '/',
            })
            notified++
          } catch (e: any) {
            failures.push({ id: u.id, reason: `notification: ${e?.message}` })
          }

          const email = (u.real_email || '').trim().toLowerCase()
          if (!email || !email.includes('@')) {
            failures.push({ id: u.id, reason: 'no real email' })
          } else if (supSet.has(email)) {
            failures.push({ id: u.id, email, reason: 'suppressed' })
          } else {
            try {
              const token = await getOrCreateUnsubToken(email)
              const unsubscribeUrl = buildUnsubUrl(token)
              const subject = `Action required: accept VibTribe's Terms & Privacy within ${OFFBOARD_DAYS} days`
              const preheader = `Re-open VibTribe and accept the updated Terms & Privacy to keep your account active.`
              const html = wrapCampaignHtml({
                subject, preheader,
                bodyHtml: buildBodyHtml(u.full_name || '', deadline),
                unsubscribeUrl, recipientEmail: email,
              })
              const result = await resendSend({
                to: email, subject, html, text: htmlToText(html), unsubscribeUrl, preheader,
              })
              await supabaseAdmin.from('email_send_log').insert({
                template_name: 'policy_acceptance_reminder',
                recipient_email: email,
                message_id: result.id || `policy-reminder-${u.id}-${Date.now()}`,
                status: result.ok ? 'sent' : 'failed',
                error_message: result.ok ? null : (result.error || `HTTP ${result.status}`),
                metadata: { user_id: u.id, deadline: deadline.toISOString() },
              }).then(() => {}, () => {})
              if (result.ok) emailed++
              else { emailFailed++; failures.push({ id: u.id, email, reason: result.error || `HTTP ${result.status}` }) }
              await new Promise(r => setTimeout(r, 150))
            } catch (e: any) {
              emailFailed++
              failures.push({ id: u.id, email, reason: `email exception: ${e?.message}` })
            }
          }

          await supabaseAdmin
            .from('user_profiles')
            .update({ terms_warning_sent_at: now.toISOString() })
            .eq('id', u.id)
        }

        return new Response(JSON.stringify({
          ok: true, total: targets?.length ?? 0, notified, emailed, emailFailed,
          deadline: deadline.toISOString(), failures,
        }), { headers: { 'content-type': 'application/json' } })
      },
    },
  },
})