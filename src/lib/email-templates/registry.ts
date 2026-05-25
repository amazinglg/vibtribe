import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as otpCode } from './otp-code'
import { template as welcome } from './welcome'
import { template as ticketReply } from './ticket-reply'
import { template as notification } from './notification'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'otp-code': otpCode,
  'welcome': welcome,
  'ticket-reply': ticketReply,
  'notification': notification,
}
