/**
 * Offline-cache privacy controls.
 *
 *  - Maximum Privacy Mode: wipes the encrypted cache and the wrapped Cache
 *    Master Key on logout, and clears decrypted memory whenever the app is
 *    backgrounded.
 *  - Trust Lock: conversations stay cached (encrypted) so they open instantly,
 *    but decrypted memory is dropped the moment the app leaves the foreground
 *    and no previews or notifications are ever produced from the cache.
 *  - Cloud backup: the cache database is marked no-backup on native so it is
 *    excluded from Google Drive / iCloud backups.
 */
import { supabase } from '@/integrations/supabase/client';
import { forgetCacheKeyInMemory } from './cache-crypto';
import { applyMediaBudget, secureWipe, type WipeReason } from './sync-engine';

export type MediaCacheLimit = 250 | 500 | 1024 | 0; // 0 === unlimited

export interface CachePrefs {
  maxPrivacyMode: boolean;
  mediaCacheLimitMb: MediaCacheLimit;
}

const DEFAULTS: CachePrefs = { maxPrivacyMode: false, mediaCacheLimitMb: 250 };

export async function loadCachePrefs(userId: string): Promise<CachePrefs> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('max_privacy_mode, media_cache_limit_mb')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      maxPrivacyMode: !!(data as Record<string, unknown>).max_privacy_mode,
      mediaCacheLimitMb: (((data as Record<string, unknown>).media_cache_limit_mb as number) ??
        250) as MediaCacheLimit,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveCachePrefs(
  userId: string,
  prefs: Partial<CachePrefs>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (prefs.maxPrivacyMode !== undefined) patch.max_privacy_mode = prefs.maxPrivacyMode;
  if (prefs.mediaCacheLimitMb !== undefined)
    patch.media_cache_limit_mb = prefs.mediaCacheLimitMb;
  if (!Object.keys(patch).length) return;
  await supabase.from('user_profiles').update(patch).eq('id', userId);
  if (prefs.mediaCacheLimitMb !== undefined)
    await applyMediaBudget(userId, prefs.mediaCacheLimitMb);
}

let teardown: (() => void) | null = null;

/**
 * Install lifecycle protection. Call once per signed-in session.
 * Returns a disposer.
 */
export function installCachePrivacy(userId: string, prefs: CachePrefs): () => void {
  teardown?.();
  if (typeof window === 'undefined') return () => {};

  const onBackground = () => {
    // Always drop decrypted memory for Trust Lock safety; in Maximum Privacy
    // Mode this also forces a fresh key unwrap on return.
    forgetCacheKeyInMemory(userId);
    window.dispatchEvent(new CustomEvent('vt-cache-memory-cleared'));
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') onBackground();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('vt-app-paused', onBackground);
  window.addEventListener('pagehide', onBackground);

  void applyMediaBudget(userId, prefs.mediaCacheLimitMb);

  teardown = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('vt-app-paused', onBackground);
    window.removeEventListener('pagehide', onBackground);
    teardown = null;
  };
  return teardown;
}

/** Logout / remote-logout / manual-clear entry point. */
export async function wipeCacheFor(
  userId: string,
  reason: WipeReason,
  prefs?: CachePrefs,
): Promise<void> {
  const maxPrivacy = prefs?.maxPrivacyMode ?? false;
  if (reason === 'logout' && !maxPrivacy) {
    // Normal mode: keep the encrypted cache so the next launch is instant.
    forgetCacheKeyInMemory(userId);
    return;
  }
  await secureWipe(userId, reason === 'logout' ? 'privacy-mode' : reason);
}
