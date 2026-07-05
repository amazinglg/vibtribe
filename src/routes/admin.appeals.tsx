import { createFileRoute } from '@tanstack/react-router'
import AdminAppealsPage from '@/pages/AdminAppealsPage'

export const Route = createFileRoute('/admin/appeals')({
  component: AdminAppealsPage,
  head: () => ({
    meta: [
      { title: 'Appeals — VibTribe Admin' },
      { name: 'description', content: 'Review user appeals of moderation decisions.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})