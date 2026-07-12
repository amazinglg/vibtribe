import { createFileRoute } from '@tanstack/react-router'
import OffboardingAppealPage from '@/pages/OffboardingAppealPage'

export const Route = createFileRoute('/appeal-offboarding/$token')({
  component: OffboardingAppealPage,
  head: () => ({
    meta: [
      { title: 'Appeal your account removal — VibTribe' },
      { name: 'description', content: 'Appeal a VibTribe account removal decision. Our Trust & Safety team will re-review and respond by email.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})