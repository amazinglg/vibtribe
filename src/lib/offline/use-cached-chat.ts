/**
 * Cache-first conversation. Paints cached messages immediately and runs a
 * silent delta sync behind it. A skeleton is only justified when
 * `neverCached` is true — i.e. this conversation has never been downloaded.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheAvailable } from './cache-db';
import {
  deltaSyncChat,
  getCachedMessages,
  noteChatUsage,
  type CachedMessage,
  type MessageDecryptor,
} from './sync-engine';

export function useCachedChat(
  userId: string | undefined,
  chatId: string | null,
  decrypt: MessageDecryptor,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false;
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [neverCached, setNeverCached] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const decryptRef = useRef(decrypt);
  decryptRef.current = decrypt;

  const refresh = useCallback(async () => {
    if (!userId || !chatId || !enabled || !cacheAvailable()) return;
    setSyncing(true);
    try {
      const { messages: merged } = await deltaSyncChat(userId, chatId, decryptRef.current);
      setMessages(merged);
      if (merged.length) setNeverCached(false);
    } catch {
      /* stay on cached data */
    } finally {
      setSyncing(false);
    }
  }, [userId, chatId, enabled]);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !chatId || !enabled || !cacheAvailable()) {
      setMessages([]);
      setNeverCached(true);
      return;
    }
    // 1. instant paint from the encrypted cache
    getCachedMessages(userId, chatId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
        setNeverCached(rows.length === 0);
      })
      .catch(() => {})
      // 2. silent delta sync
      .finally(() => { if (!cancelled) void refresh(); });

    void noteChatUsage(userId, chatId);
    return () => { cancelled = true; };
  }, [userId, chatId, enabled, refresh]);

  return { cachedMessages: messages, neverCached, syncing, refresh, setCachedMessages: setMessages };
}
