// Shared styles/constants for VibTribe email templates.
// Keep this pure — no React, no server-only imports.

export const SITE_NAME = 'VibTribe'
export const SITE_URL = 'https://www.vibtribe.in'
export const LOGO_URL = 'https://www.vibtribe.in/icons/icon-192x192.png'
export const SUPPORT_EMAIL = 'help.vibtribe.in@gmail.com'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '32px 12px',
}
export const container = {
  padding: '0',
  maxWidth: '560px',
  margin: '0 auto',
}
export const card = {
  background: '#ffffff',
  border: '1px solid #ece7dc',
  borderRadius: '16px',
  padding: '36px 32px 32px',
  boxShadow: '0 1px 0 rgba(31,29,26,0.04)',
}
export const logo = { borderRadius: '12px', marginBottom: '18px' }
export const eyebrow = {
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#7C3AED',
  fontWeight: 700 as const,
  margin: '0 0 10px',
}
export const h1 = {
  fontSize: '24px',
  lineHeight: 1.25,
  fontWeight: 700 as const,
  color: '#0a0a0f',
  margin: '0 0 14px',
  letterSpacing: '-0.01em',
}
export const text = {
  fontSize: '15px',
  color: '#454852',
  lineHeight: 1.65,
  margin: '0 0 14px',
}
export const muted = {
  fontSize: '13px',
  color: '#7a7468',
  lineHeight: 1.6,
  margin: '0 0 12px',
}
export const button = {
  background: 'linear-gradient(90deg,#7C3AED 0%,#6366f1 60%,#3b82f6 100%)',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '12px',
  padding: '13px 22px',
  textDecoration: 'none',
  display: 'inline-block',
  fontWeight: 700 as const,
  marginTop: '10px',
}
export const footer = {
  fontSize: '12px',
  color: '#9a9484',
  margin: '24px 0 0',
  lineHeight: 1.6,
}
export const legalBlock = {
  marginTop: '22px',
  padding: '14px 16px',
  background: '#faf7f1',
  border: '1px solid #efe7dc',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#7a7468',
  lineHeight: 1.6,
}