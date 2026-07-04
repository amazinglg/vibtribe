// @ts-nocheck
// Client helper that resolves effective avatar URLs after applying the owner's
// profile-photo visibility settings ('all' / 'contacts' / 'selected').
// Uses the SECURITY DEFINER RPC public.visible_avatar_urls so the viewer
// doesn't need read access on the owner's contacts / allowlist.

import { supabase } from '@/integrations/supabase/client';

type CacheEntry = { url: string | null; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export async function resolveVisibleAvatars(ownerIds: string[]): Promise<Map<string, string | null>> {
  const uniq = [...new Set((ownerIds || []).filter(Boolean))];
  const out = new Map<string, string | null>();
  const now = Date.now();
  const misses: string[] = [];
  for (const id of uniq) {
    const c = cache.get(id);
    if (c && c.expires > now) out.set(id, c.url);
    else misses.push(id);
  }
  if (misses.length === 0) return out;
  try {
    const { data, error } = await supabase.rpc('visible_avatar_urls', { _owner_ids: misses });
    if (error) throw error;
    for (const row of (data || []) as any[]) {
      cache.set(row.id, { url: row.avatar_url ?? null, expires: now + TTL_MS });
      out.set(row.id, row.avatar_url ?? null);
    }
    // Fill unknowns to avoid endless retries
    for (const id of misses) {
      if (!out.has(id)) {
        cache.set(id, { url: null, expires: now + TTL_MS });
        out.set(id, null);
      }
    }
  } catch {
    for (const id of misses) out.set(id, null);
  }
  return out;
}

export function invalidateVisibleAvatar(ownerId?: string) {
  if (!ownerId) cache.clear();
  else cache.delete(ownerId);
}