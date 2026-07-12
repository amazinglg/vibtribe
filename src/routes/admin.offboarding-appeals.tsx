import { createFileRoute } from '@tanstack/react-router'
import AdminOffboardingAppealsPage from '@/pages/AdminOffboardingAppealsPage'

export const Route = createFileRoute('/admin/offboarding-appeals')({
  component: AdminOffboardingAppealsPage,
  head: () => ({
    meta: [
      { title: 'Offboarding appeals — VibTribe Admin' },
      { name: 'description', content: 'Review appeals from offboarded users.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})