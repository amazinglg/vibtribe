/**
 * VibTribe offline cache — delta sync engine.
 *
 * Realtime remains the primary live path. This engine is the reconciliation
 * layer: it pulls only rows changed since the per-chat cursor, purges
 * tombstoned rows, drives the outbox, and orders startup work by an
 * MRU + frequency (predictive) score instead of an arbitrary chat count.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  cacheAvailable,
  countMessages,
  deleteMessages,
  dequeueOutbox,
  enqueueOutbox,
  metaGet,
  metaSet,
  putMessages,
  readMessages,
  readOutbox,
  trimChat,
  updateOutboxAttempt,
  wipeUserCache,
  destroyCacheDb,
  sweepMedia,
} from './cache-db';
import { destroyCacheKey, forgetCacheKeyInMemory } from './cache-crypto';

export interface CachedMessage {
  id: string;
  chat_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
  message_status?: string | null;
  message_type?: string | null;
  reactions?: unknown;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
  deleted_for?: string[];
  pending?: boolean;
  [k: string]: unknown;
}

/** Caller-supplied hook that turns a raw DB row into render-ready content. */
export type MessageDecryptor = (row: Record<string, unknown>) => Promise<CachedMessage>;

const cursorKey = (userId: string, chatId: string) => `cursor:${userId}:${chatId}`;
const usageKey = (userId: string) => `usage:${userId}`;

// ------------------------------------------------- MRU / predictive score
type Usage = Record<string, { last: number; count: number }>;

export async function noteChatUsage(userId: string, chatId: string): Promise<void> {
  if (!cacheAvailable()) return;
  const usage = ((await metaGet<Usage>(usageKey(userId))) || {}) as Usage;
  const cur = usage[chatId] || { last: 0, count: 0 };
  usage[chatId] = { last: Date.now(), count: cur.count + 1 };
  await metaSet(usageKey(userId), usage);
}

/**
 * Higher score syncs first. Recency dominates, frequency breaks ties, so
 * conversations the user actually lives in are ready before the rest.
 */
export async function prioritiseChats(userId: string, chatIds: string[]): Promise<string[]> {
  const usage = ((await metaGet<Usage>(usageKey(userId))) || {}) as Usage;
  const now = Date.now();
  const score = (id: string) => {
    const u = usage[id];
    if (!u) return 0;
    const ageDays = (now - u.last) / 86400_000;
    const recency = 1 / (1 + ageDays);
    const frequency = Math.log2(1 + u.count);
    return recency * 10 + frequency;
  };
  return [...chatIds].sort((a, b) => score(b) - score(a));
}

// ------------------------------------------------------------ delta sync
/** In-flight delta syncs, keyed by user+chat, so concurrent callers share one run. */
const inFlightSyncs = new Map<string, Promise<{ changed: number; messages: CachedMessage[] }>>();

export async function getCachedMessages(
  userId: string,
  chatId: string,
  limit = 2000,
): Promise<CachedMessage[]> {
  const rows = await readMessages<CachedMessage>(userId, chatId, limit);
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function hasCachedChat(chatId: string): Promise<boolean> {
  return (await countMessages(chatId)) > 0;
}

/**
 * Pull only what changed since the cursor, merge into the encrypted cache and
 * return the merged conversation. Server wins on content/status; rows still
 * queued in the outbox are preserved locally.
 */
export async function deltaSyncChat(
  userId: string,
  chatId: string,
  decrypt: MessageDecryptor,
  opts: { pageSize?: number } = {},
): Promise<{ changed: number; messages: CachedMessage[] }> {
  if (!cacheAvailable()) return { changed: 0, messages: [] };
  const flightKey = `${userId}:${chatId}`;
  const existing = inFlightSyncs.get(flightKey);
  if (existing) return existing;
  const run = runDeltaSync(userId, chatId, decrypt, opts).finally(() => {
    inFlightSyncs.delete(flightKey);
  });
  inFlightSyncs.set(flightKey, run);
  return run;
}

async function runDeltaSync(
  userId: string,
  chatId: string,
  decrypt: MessageDecryptor,
  opts: { pageSize?: number } = {},
): Promise<{ changed: number; messages: CachedMessage[] }> {
  const cursor = (await metaGet<string>(cursorKey(userId, chatId))) || null;
  const firstRun = !cursor;

  let query = supabase
    .from('messages')
    .select(
      'id, chat_id, sender_id, content, message_status, message_type, reactions, created_at, updated_at, edited_at, expires_at, deleted_for_everyone, deleted_for',
    )
    .eq('chat_id', chatId);

  if (cursor) query = query.gt('updated_at', cursor);

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(opts.pageSize ?? (firstRun ? 200 : 500));

  if (error) return { changed: 0, messages: await getCachedMessages(userId, chatId) };

  const rows = (data || []) as Array<Record<string, unknown>>;
  if (rows.length) {
    const decrypted: CachedMessage[] = [];
    for (const r of rows) {
      try {
        decrypted.push(await decrypt(r));
      } catch {
        /* skip rows we cannot render */
      }
    }
    await putMessages(userId, chatId, decrypted as never, 'synced');
    const newest = rows
      .map((r) => String(r.updated_at || r.created_at))
      .sort()
      .pop();
    if (newest) await metaSet(cursorKey(userId, chatId), newest);
  } else if (firstRun) {
    await metaSet(cursorKey(userId, chatId), new Date().toISOString());
  }

  await purgeTombstones(userId, chatId);
  await trimChat(chatId);

  return { changed: rows.length, messages: await getCachedMessages(userId, chatId) };
}

/** Drop cached rows for messages that were hard-deleted server-side. */
export async function purgeTombstones(userId: string, chatId: string): Promise<void> {
  const key = `tomb:${userId}:${chatId}`;
  const since = (await metaGet<string>(key)) || new Date(0).toISOString();
  const { data } = await supabase
    .from('message_tombstones')
    .select('id, deleted_at')
    .eq('chat_id', chatId)
    .gt('deleted_at', since)
    .order('deleted_at', { ascending: false })
    .limit(500);
  const rows = (data || []) as Array<{ id: string; deleted_at: string }>;
  if (!rows.length) return;
  await deleteMessages(rows.map((r) => r.id));
  await metaSet(key, rows[0].deleted_at);
}

/** Write a single realtime message straight into the encrypted cache. */
export async function cacheMessage(
  userId: string,
  chatId: string,
  message: CachedMessage,
): Promise<void> {
  await putMessages(userId, chatId, [message] as never, 'synced');
}

export async function dropCachedMessages(ids: string[]): Promise<void> {
  await deleteMessages(ids);
}

// ---------------------------------------------------------------- outbox
export type OutboxSender = (payload: Record<string, unknown>) => Promise<void>;

/** Queue a message composed while offline. Renders immediately as Pending. */
export async function queueOutgoing(
  userId: string,
  chatId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const localId = await enqueueOutbox(userId, chatId, payload);
  if (localId) {
    await putMessages(
      userId,
      chatId,
      [
        {
          ...payload,
          id: localId,
          chat_id: chatId,
          created_at: new Date().toISOString(),
          pending: true,
        } as never,
      ],
      'pending',
    );
  }
  return localId;
}

let flushing = false;

/** Retry queued sends with exponential backoff. Safe to call repeatedly. */
export async function flushOutbox(userId: string, send: OutboxSender): Promise<number> {
  if (flushing || !cacheAvailable()) return 0;
  flushing = true;
  let sent = 0;
  try {
    const queued = await readOutbox<Record<string, unknown>>(userId);
    for (const item of queued) {
      if (item.row.next_attempt_at > Date.now()) continue;
      try {
        await send(item.payload);
        await dequeueOutbox(item.row.local_id);
        await deleteMessages([item.row.local_id]);
        sent++;
      } catch {
        const delay = Math.min(5 * 60_000, 2000 * 2 ** item.row.attempts);
        await updateOutboxAttempt(item.row, delay);
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

export async function pendingOutboxCount(userId: string): Promise<number> {
  return (await readOutbox(userId)).length;
}

// -------------------------------------------------- startup / background
/**
 * Warm the cache in priority order after launch. Runs sequentially so a cold
 * start never floods the network or the battery.
 */
export async function warmStartupSync(
  userId: string,
  chatIds: string[],
  decrypt: MessageDecryptor,
): Promise<void> {
  if (!cacheAvailable() || !chatIds.length) return;
  const ordered = await prioritiseChats(userId, chatIds);
  for (const chatId of ordered) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    try {
      await deltaSyncChat(userId, chatId, decrypt, { pageSize: 100 });
    } catch {
      /* keep warming the rest */
    }
    await new Promise((r) => setTimeout(r, 60)); // gentle on battery
  }
}

export async function applyMediaBudget(userId: string, limitMb: number): Promise<void> {
  await sweepMedia(userId, limitMb);
}

// ------------------------------------------------------------ secure wipe
export type WipeReason =
  | 'logout'
  | 'manual'
  | 'remote-logout'
  | 'guardian'
  | 'auth-failures'
  | 'privacy-mode';

/** Secure cache removal. Wipes records and the wrapped Cache Master Key. */
export async function secureWipe(userId: string, reason: WipeReason): Promise<void> {
  try {
    await wipeUserCache(userId);
  } catch {}
  if (reason !== 'manual') {
    try { await destroyCacheKey(userId); } catch {}
  }
  if (reason === 'privacy-mode' || reason === 'remote-logout' || reason === 'guardian') {
    try { await destroyCacheDb(); } catch {}
  }
  forgetCacheKeyInMemory(userId);
}
