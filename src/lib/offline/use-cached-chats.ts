/**
 * Cache-first chat list. Returns whatever is in the encrypted cache
 * synchronously-after-mount so the list paints without a skeleton, then the
 * caller refreshes it in the background.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheAvailable, putChatSummaries, readChatSummaries } from './cache-db';

export function useCachedChats<T extends { id: string; updated_at?: string }>(
  userId: string | undefined,
) {
  const [cached, setCached] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hadCache = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !cacheAvailable()) {
      setHydrated(true);
      return;
    }
    readChatSummaries<T>(userId)
      .then((rows) => {
        if (cancelled) return;
        hadCache.current = rows.length > 0;
        setCached(rows);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const persist = useCallback(
    async (chats: T[]) => {
      if (!userId || !cacheAvailable()) return;
      hadCache.current = chats.length > 0;
      try {
        await putChatSummaries(
          userId,
          chats.map((c) => ({ ...c, updated_at: c.updated_at || new Date().toISOString() })),
        );
      } catch {}
    },
    [userId],
  );

  return { cachedChats: cached, cacheHydrated: hydrated, hadCache: hadCache.current, persistChats: persist };
}
