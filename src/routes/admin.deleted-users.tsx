import { createFileRoute } from '@tanstack/react-router'
import AdminDeletedUsersPage from '@/pages/AdminDeletedUsersPage'

export const Route = createFileRoute('/admin/deleted-users')({
  component: AdminDeletedUsersPage,
  head: () => ({
    meta: [
      { title: 'Deleted users — VibTribe Admin' },
      { name: 'description', content: 'Audit log of deleted VibTribe accounts.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})