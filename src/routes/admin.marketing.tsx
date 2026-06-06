import { createFileRoute } from '@tanstack/react-router'
import MarketingPage from '@/pages/MarketingPage'

export const Route = createFileRoute('/admin/marketing')({
  component: MarketingPage,
})