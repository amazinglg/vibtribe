import { createFileRoute } from '@tanstack/react-router'
import PermissionsPage from '@/pages/PermissionsPage'

export const Route = createFileRoute('/admin/permissions')({
  component: PermissionsPage,
})