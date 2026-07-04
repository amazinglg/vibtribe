import { supabase } from '@/integrations/supabase/client';

// After making the `chat-media` bucket private (for DPDP/RLS enforcement),
// direct public URLs stop resolving. This helper extracts the storage path
// from either a raw storage path or a legacy public URL and returns a short-
// lived signed URL that RLS actually gates ("Participants read chat media").
//
// - Legacy stored values: `https://<proj>.supabase.co/storage/v1/object/public/chat-media/<path>?...`
// - New stored values may be the raw `<path>` inside the bucket.
// - Anything not recognised (blob:, data:, other origins) is returned as-is.

const MARKER = '/chat-media/'
const SIGN_TTL_SECONDS = 60 * 60 // 1 hour
const cache = new Map<string, { url: string; expires: number }>()

function extractPath(input: string): string | null {
  if (!input) return null
  if (input.startsWith('blob:') || input.startsWith('data:')) return null
  // Full public URL for our chat-media bucket
  const idx = input.indexOf(MARKER)
  if (idx !== -1) {
    const tail = input.slice(idx + MARKER.length)
    const stop = tail.search(/[?#]/)
    const raw = stop === -1 ? tail : tail.slice(0, stop)
    try { return decodeURIComponent(raw) } catch { return raw }
  }
  // If it already looks like an already-signed URL, leave it alone.
  if (/\/storage\/v1\/object\/sign\//.test(input)) return null
  // Not a chat-media URL we can sign.
  return null
}

export async function signChatMediaUrl(input: string): Promise<string> {
  if (!input) return input
  const path = extractPath(input)
  if (!path) return input

  const now = Date.now()
  const hit = cache.get(path)
  if (hit && hit.expires > now + 30_000) return hit.url

  const { data, error } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(path, SIGN_TTL_SECONDS)
  if (error || !data?.signedUrl) return input
  cache.set(path, { url: data.signedUrl, expires: now + SIGN_TTL_SECONDS * 1000 })
  return data.signedUrl
}