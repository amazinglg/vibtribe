import { createFileRoute } from '@tanstack/react-router'
import AdminPremiumUsersPage from '@/pages/AdminPremiumUsersPage'

export const Route = createFileRoute('/admin/premium-users')({
  component: AdminPremiumUsersPage,
})