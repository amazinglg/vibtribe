import { createFileRoute } from '@tanstack/react-router'
import PermissionsPage from '@/pages/PermissionsPage'

export const Route = createFileRoute('/admin/permissions')({
  component: PermissionsPage,
  head: () => ({
    meta: [
      { title: 'Permissions Admin — VibTribe' },
      { name: 'description', content: 'Private VibTribe permissions administration area.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Permissions Admin — VibTribe' },
      { property: 'og:description', content: 'Private VibTribe permissions administration area.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
})