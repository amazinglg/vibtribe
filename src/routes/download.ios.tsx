import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/download/ios')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/download/ios"!</div>
}
