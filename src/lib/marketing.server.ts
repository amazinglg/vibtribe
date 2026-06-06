// Server-only Resend helper. Never imported from client code.
// Marketing emails are sent via Resend (separate from transactional/auth
// emails which use the Lovable Email queue). This isolates promotional
// reputation on the dedicated `news.vibtribe.in` subdomain.

export const MARKETING_FROM = 'VibTribe <promotions@news.vibtribe.in>'
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
    ? `<img src="${escapeHtml(opts.bannerImageUrl)}" alt="" style="display:block;width:100%;max-width:640px;height:auto;border:0;outline:none;text-decoration:none;" />`
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
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f1d1a;-webkit-font-smoothing:antialiased;">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f0e8">
  <tr><td align="center" style="padding:32px 16px 12px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
      <tr><td style="padding:0 4px 18px 4px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#1f1d1a;">
        VibTribe
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e8e1d5;border-radius:14px;overflow:hidden;box-shadow:0 1px 0 rgba(31,29,26,0.04);">
      ${banner ? `<tr><td style="padding:0;">${banner}</td></tr>` : ''}
      <tr><td style="padding:36px 36px 28px 36px;font-size:16px;line-height:1.7;color:#1f1d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${opts.bodyHtml}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
      <tr><td style="padding:22px 8px 36px 8px;font-size:12px;line-height:1.7;color:#7a7468;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0 0 6px 0;">You're receiving this because you opted in to product updates from VibTribe.</p>
        <p style="margin:0 0 10px 0;">VibTribe · India</p>
        <p style="margin:0;">
          <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#1f1d1a;text-decoration:underline;">Unsubscribe in one click</a>
          &nbsp;·&nbsp;
          <a href="https://www.vibtribe.in/privacy" style="color:#1f1d1a;text-decoration:underline;">Privacy</a>
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