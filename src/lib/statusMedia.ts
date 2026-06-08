import { supabase } from "@/integrations/supabase/client";

const SIGN_TTL_SECONDS = 60 * 60; // 1h
const cache = new Map<string, { url: string; exp: number }>();

export function extractStatusMediaPath(value?: string | null): string | null {
  if (!value) return null;
  const marker = "/status-media/";
  const idx = value.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(value.slice(idx + marker.length).split("?")[0]);
  // Otherwise assume it's already a storage path
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  return null;
}

export async function getSignedStatusMediaUrl(value?: string | null): Promise<string | null> {
  const path = extractStatusMediaPath(value);
  if (!path) return null;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now + 30_000) return hit.url;
  const { data, error } = await supabase.storage
    .from("status-media")
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: now + SIGN_TTL_SECONDS * 1000 });
  return data.signedUrl;
}