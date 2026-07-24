import { createFileRoute } from '@tanstack/react-router'
import apkAsset from '@/assets/VibTribe-v2.1.3.apk.asset.json'

export const Route = createFileRoute('/api/public/download-apk')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const assetUrl = origin + apkAsset.url
        const response = await fetch(assetUrl)
        if (!response.ok) {
          return new Response('Asset not found', { status: 502 })
        }
        return new Response(response.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="VibTribe-v2.1.3.apk"',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })
      },
    },
  },
})
