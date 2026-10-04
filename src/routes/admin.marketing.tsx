import { createFileRoute } from '@tanstack/react-router'
import MarketingPage from '@/pages/MarketingPage'

export const Route = createFileRoute('/admin/marketing')({
  component: MarketingPage,
  head: () => ({
    meta: [
      { title: 'Marketing Admin — VibTribe' },
      { name: 'description', content: 'Private VibTribe marketing administration area.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Marketing Admin — VibTribe' },
      { property: 'og:description', content: 'Private VibTribe marketing administration area.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
})