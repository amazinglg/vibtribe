import { createFileRoute } from '@tanstack/react-router'
import GuardianSetupPage from '@/pages/GuardianSetupPage'

const TITLE = 'Guardian consent — VibTribe'
const DESCRIPTION = 'Set up guardian consent so under-18 users can safely use VibTribe under DPDP 2023.'
const URL = 'https://www.vibtribe.in/guardian-setup'

export const Route = createFileRoute('/guardian-setup')({
  component: GuardianSetupPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'noindex' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
})