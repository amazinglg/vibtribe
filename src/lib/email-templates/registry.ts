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
import { template as guardianOtp } from './guardian-otp'
import { template as guardianConsentRequest } from './guardian-consent-request'
import { template as incompleteSignupReminder } from './incomplete-signup-reminder'
import { template as offboardingGeneral } from './offboarding-general'
import { template as offboardingTermsBreach } from './offboarding-terms-breach'
import { template as offboardingIncompleteSignup } from './offboarding-incomplete-signup'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'otp-code': otpCode,
  'welcome': welcome,
  'ticket-reply': ticketReply,
  'notification': notification,
  'guardian-otp': guardianOtp,
  'guardian-consent-request': guardianConsentRequest,
  'incomplete-signup-reminder': incompleteSignupReminder,
  'offboarding-general': offboardingGeneral,
  'offboarding-terms-breach': offboardingTermsBreach,
  'offboarding-incomplete-signup': offboardingIncompleteSignup,
}
