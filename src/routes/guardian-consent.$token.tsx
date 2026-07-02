import { createFileRoute } from '@tanstack/react-router'
import GuardianConsentPage from '@/pages/GuardianConsentPage'

const TITLE = 'Guardian consent — VibTribe'
const DESCRIPTION = 'Review and confirm your consent for a young person to use VibTribe.'

export const Route = createFileRoute('/guardian-consent/$token')({
  component: GuardianConsentPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'noindex' },
    ],
  }),
})