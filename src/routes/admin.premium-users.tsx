import { createFileRoute } from '@tanstack/react-router'
import AdminPremiumUsersPage from '@/pages/AdminPremiumUsersPage'

export const Route = createFileRoute('/admin/premium-users')({
  component: AdminPremiumUsersPage,
  head: () => ({
    meta: [
      { title: 'Premium Users Admin — VibTribe' },
      { name: 'description', content: 'Private VibTribe premium-user administration area.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Premium Users Admin — VibTribe' },
      { property: 'og:description', content: 'Private VibTribe premium-user administration area.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
})