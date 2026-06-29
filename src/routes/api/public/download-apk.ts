import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/download-apk')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const assetUrl =
          origin +
          '/__l5e/assets-v1/130795b7-4179-4c74-8100-7e0e4bc13034/VibTribe_v1.2.2.zip'
        const response = await fetch(assetUrl)
        if (!response.ok) {
          return new Response('Asset not found', { status: 502 })
        }
        return new Response(response.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="VibTribe_v1.2.2.apk"',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })
      },
    },
  },
})
