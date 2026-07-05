import { createFileRoute } from '@tanstack/react-router'
import UserAppealPage from '@/pages/UserAppealPage'

export const Route = createFileRoute('/appeal/$reportId')({
  component: UserAppealPage,
  head: () => ({
    meta: [
      { title: 'Appeal a Decision — VibTribe' },
      { name: 'description', content: 'Appeal a VibTribe moderation decision. Our team will re-review and respond in-app.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})