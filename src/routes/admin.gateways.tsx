import { createFileRoute } from '@tanstack/react-router'
import AdminGatewaysPage from '@/pages/AdminGatewaysPage'

export const Route = createFileRoute('/admin/gateways')({
  component: AdminGatewaysPage,
})
