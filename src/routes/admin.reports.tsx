import { createFileRoute } from '@tanstack/react-router'
import AdminReportsPage from '@/pages/AdminReportsPage'

export const Route = createFileRoute('/admin/reports')({
  component: AdminReportsPage,
  head: () => ({
    meta: [
      { title: 'Reports — VibTribe Admin' },
      { name: 'description', content: 'Review reported content across VibTribe.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})