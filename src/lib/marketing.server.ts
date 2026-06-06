// Server-only Resend helper. Never imported from client code.
// Marketing emails are sent via Resend (separate from transactional/auth
// emails which use the Lovable Email queue). This isolates promotional
// reputation on the dedicated `news.vibtribe.in` subdomain.

export const MARKETING_FROM = 'VibTribe <hello@news.vibtribe.in>'
export const MARKETING_REPLY_TO = 'Labhansh.garg@outlook.com'
export const MARKETING_PHYSICAL_ADDRESS =
  'VibTribe · Labhansh Garg, Founder · Labhansh.garg@outlook.com'

export interface ResendSendInput {
  to: string
  subject: string
  html: string
  text?: string
  unsubscribeUrl: string
  preheader?: string
}

export interface ResendSendResult {
  ok: boolean
  id?: string
  error?: string
  status?: number
}

export async function resendSend(input: ResendSendInput): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not configured', status: 500 }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: MARKETING_FROM,
        to: [input.to],
        reply_to: MARKETING_REPLY_TO,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: {
          'List-Unsubscribe': `<${input.unsubscribeUrl}>, <mailto:${MARKETING_REPLY_TO}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: json?.message || `Resend HTTP ${res.status}`, status: res.status }
    }
    return { ok: true, id: json?.id, status: res.status }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error contacting Resend' }
  }
}

/** Wrap user-authored campaign HTML with a compliant footer. */
export function wrapCampaignHtml(opts: {
  subject: string
  preheader?: string
  bodyHtml: string
  bannerImageUrl?: string | null
  unsubscribeUrl: string
  recipientEmail: string
}): string {
  const banner = opts.bannerImageUrl
    ? `<img src="${escapeHtml(opts.bannerImageUrl)}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : ''
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;visibility:hidden;mso-hide:all">${escapeHtml(opts.preheader)}</div>`
    : ''
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f172a">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#1e293b;border-radius:16px;overflow:hidden;">
      ${banner ? `<tr><td>${banner}</td></tr>` : ''}
      <tr><td style="padding:32px 28px;font-size:15px;line-height:1.6;color:#e2e8f0;">${opts.bodyHtml}</td></tr>
      <tr><td style="padding:24px 28px;border-top:1px solid #334155;font-size:12px;line-height:1.6;color:#94a3b8;">
        <p style="margin:0 0 8px 0;">You're receiving this because you opted in to product updates from VibTribe.</p>
        <p style="margin:0 0 8px 0;">VibTribe · India</p>
        <p style="margin:0;">
          <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#60a5fa;text-decoration:underline;">Unsubscribe in one click</a>
          &nbsp;·&nbsp;
          <a href="https://www.vibtribe.in/privacy" style="color:#60a5fa;text-decoration:underline;">Privacy</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}