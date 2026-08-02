/**
 * VibTribe offline cache — IndexedDB storage layer.
 *
 * Only the metadata required for indexing is stored in the clear:
 *   chat_id, message_id / record id, timestamps, sync state.
 * Every payload (message body, chat summary, media bytes) is an
 * AES-256-GCM blob sealed with the device Cache Master Key.
 */

import {
  getCacheKey,
  sealRecord,
  openRecord,
  sealBytes,
  openBytes,
  type SealedRecord,
} from './cache-crypto';

const DB_NAME = 'vibtribe-cache';
const DB_VERSION = 1;

export const STORE = {
  chats: 'chats',
  messages: 'messages',
  outbox: 'outbox',
  media: 'media',
  meta: 'meta',
} as const;

// ---------------------------------------------------------------- records
/** Chat summary row. `blob` holds the encrypted summary. */
export interface CachedChatRow {
  id: string;
  user_id: string;
  updated_at: string;
  pinned_score: number;
  iv: Uint8Array<ArrayBuffer>;
  ct: ArrayBuffer;
}

export interface CachedMessageRow {
  id: string;
  chat_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sync_state: 'synced' | 'pending' | 'failed';
  iv: Uint8Array<ArrayBuffer>;
  ct: ArrayBuffer;
}

export interface OutboxRow {
  local_id: string;
  chat_id: string;
  user_id: string;
  created_at: string;
  attempts: number;
  next_attempt_at: number;
  iv: Uint8Array<ArrayBuffer>;
  ct: ArrayBuffer;
}

export interface MediaRow {
  key: string;
  chat_id: string;
  user_id: string;
  size: number;
  last_used: number;
  mime: string;
  iv: Uint8Array<ArrayBuffer>;
  ct: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function cacheAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE.chats)) {
        const s = db.createObjectStore(STORE.chats, { keyPath: 'id' });
        s.createIndex('by_user_updated', ['user_id', 'updated_at']);
      }
      if (!db.objectStoreNames.contains(STORE.messages)) {
        const s = db.createObjectStore(STORE.messages, { keyPath: 'id' });
        s.createIndex('by_chat_created', ['chat_id', 'created_at']);
        s.createIndex('by_chat_updated', ['chat_id', 'updated_at']);
        s.createIndex('by_user', 'user_id');
      }
      if (!db.objectStoreNames.contains(STORE.outbox)) {
        const s = db.createObjectStore(STORE.outbox, { keyPath: 'local_id' });
        s.createIndex('by_user', 'user_id');
        s.createIndex('by_chat', 'chat_id');
      }
      if (!db.objectStoreNames.contains(STORE.media)) {
        const s = db.createObjectStore(STORE.media, { keyPath: 'key' });
        s.createIndex('by_user_lru', ['user_id', 'last_used']);
        s.createIndex('by_user', 'user_id');
      }
      if (!db.objectStoreNames.contains(STORE.meta)) {
        db.createObjectStore(STORE.meta);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out: T | undefined;
        const req = run(s);
        if (req) req.onsuccess = () => { out = req.result; };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

function all<T>(store: string, index: string | null, range: IDBKeyRange | null): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const src = index ? t.objectStore(store).index(index) : t.objectStore(store);
        const req = src.getAll(range ?? undefined);
        req.onsuccess = () => resolve((req.result || []) as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Run many writes inside ONE IndexedDB transaction. Encryption is done by the
 * caller beforehand — this is purely a batching/perf helper.
 */
function txMany(
  store: string,
  run: (s: IDBObjectStore) => void,
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        run(t.objectStore(store));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

// ------------------------------------------------------------------ meta
export async function metaGet<T>(key: string): Promise<T | undefined> {
  if (!cacheAvailable()) return undefined;
  return (await tx<T>(STORE.meta, 'readonly', (s) => s.get(key))) as T | undefined;
}
export async function metaSet(key: string, value: unknown): Promise<void> {
  if (!cacheAvailable()) return;
  await tx(STORE.meta, 'readwrite', (s) => s.put(value as never, key));
}

// ----------------------------------------------------------------- chats
export async function putChatSummary(
  userId: string,
  chat: { id: string; updated_at: string; pinned_score?: number; [k: string]: unknown },
): Promise<void> {
  const key = await getCacheKey(userId);
  if (!key) return;
  const sealed = await sealRecord(key, chat, {
    userId,
    chatId: chat.id,
    recordId: `chat:${chat.id}`,
  });
  const row: CachedChatRow = {
    id: chat.id,
    user_id: userId,
    updated_at: chat.updated_at,
    pinned_score: chat.pinned_score ?? 0,
    iv: sealed.iv,
    ct: sealed.ct,
  };
  await tx(STORE.chats, 'readwrite', (s) => s.put(row));
}

export async function putChatSummaries(
  userId: string,
  chats: Array<{ id: string; updated_at: string; [k: string]: unknown }>,
): Promise<void> {
  if (!cacheAvailable() || !chats.length) return;
  const key = await getCacheKey(userId);
  if (!key) return;
  const rows: CachedChatRow[] = [];
  for (const chat of chats) {
    const sealed = await sealRecord(key, chat, {
      userId,
      chatId: chat.id,
      recordId: `chat:${chat.id}`,
    });
    rows.push({
      id: chat.id,
      user_id: userId,
      updated_at: chat.updated_at,
      pinned_score: (chat.pinned_score as number) ?? 0,
      iv: sealed.iv,
      ct: sealed.ct,
    });
  }
  await txMany(STORE.chats, (s) => { for (const r of rows) s.put(r); });
}

export async function readChatSummaries<T = Record<string, unknown>>(
  userId: string,
): Promise<T[]> {
  if (!cacheAvailable()) return [];
  const key = await getCacheKey(userId);
  if (!key) return [];
  const rows = await all<CachedChatRow>(
    STORE.chats,
    'by_user_updated',
    IDBKeyRange.bound([userId, ''], [userId, '\uffff']),
  );
  const out: T[] = [];
  for (const r of rows) {
    const v = await openRecord<T>(key, { iv: r.iv, ct: r.ct }, {
      userId,
      chatId: r.id,
      recordId: `chat:${r.id}`,
    });
    if (v) out.push(v);
  }
  return out.reverse(); // newest first (index is ascending)
}

export async function deleteChat(chatId: string): Promise<void> {
  if (!cacheAvailable()) return;
  await tx(STORE.chats, 'readwrite', (s) => s.delete(chatId));
  const rows = await all<CachedMessageRow>(
    STORE.messages,
    'by_chat_created',
    IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']),
  );
  if (rows.length)
    await txMany(STORE.messages, (s) => { for (const r of rows) s.delete(r.id); });
}

// -------------------------------------------------------------- messages
export async function putMessages(
  userId: string,
  chatId: string,
  messages: Array<{ id: string; created_at: string; updated_at?: string; [k: string]: unknown }>,
  syncState: CachedMessageRow['sync_state'] = 'synced',
): Promise<void> {
  const key = await getCacheKey(userId);
  if (!key) return;
  if (!messages.length) return;
  // Seal first (async crypto), then commit every row in ONE transaction.
  const rows: CachedMessageRow[] = [];
  for (const m of messages) {
    const sealed = await sealRecord(key, m, { userId, chatId, recordId: m.id });
    rows.push({
      id: m.id,
      chat_id: chatId,
      user_id: userId,
      created_at: m.created_at,
      updated_at: m.updated_at || m.created_at,
      sync_state: syncState,
      iv: sealed.iv,
      ct: sealed.ct,
    });
  }
  await txMany(STORE.messages, (s) => { for (const r of rows) s.put(r); });
}

export async function readMessages<T = Record<string, unknown>>(
  userId: string,
  chatId: string,
  limit = 2000,
): Promise<T[]> {
  if (!cacheAvailable()) return [];
  const key = await getCacheKey(userId);
  if (!key) return [];
  const rows = await all<CachedMessageRow>(
    STORE.messages,
    'by_chat_created',
    IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']),
  );
  const slice = rows.slice(Math.max(0, rows.length - limit));
  const out: T[] = [];
  for (const r of slice) {
    const v = await openRecord<T>(key, { iv: r.iv, ct: r.ct }, {
      userId,
      chatId,
      recordId: r.id,
    });
    if (v) out.push(v);
  }
  return out;
}

export async function countMessages(chatId: string): Promise<number> {
  if (!cacheAvailable()) return 0;
  const rows = await all<CachedMessageRow>(
    STORE.messages,
    'by_chat_created',
    IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']),
  );
  return rows.length;
}

export async function deleteMessages(ids: string[]): Promise<void> {
  if (!cacheAvailable() || !ids.length) return;
  await txMany(STORE.messages, (s) => { for (const id of ids) s.delete(id); });
}

/**
 * Dynamic retention: keep everything for small chats, otherwise keep the
 * newest `maxMessages` OR anything inside `maxDays`, whichever is larger.
 * Older history stays fetchable on demand and is re-cached when read.
 */
export async function trimChat(
  chatId: string,
  maxMessages = 2000,
  maxDays = 90,
): Promise<void> {
  if (!cacheAvailable()) return;
  const rows = await all<CachedMessageRow>(
    STORE.messages,
    'by_chat_created',
    IDBKeyRange.bound([chatId, ''], [chatId, '\uffff']),
  );
  if (rows.length <= maxMessages) return;
  const cutoff = Date.now() - maxDays * 86400_000;
  const keepFrom = rows.length - maxMessages;
  const drop = rows
    .slice(0, keepFrom)
    .filter((r) => new Date(r.created_at).getTime() < cutoff)
    .map((r) => r.id);
  await deleteMessages(drop);
}

// ---------------------------------------------------------------- outbox
export async function enqueueOutbox(
  userId: string,
  chatId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const key = await getCacheKey(userId);
  if (!key) return null;
  const localId = `local_${crypto.randomUUID()}`;
  const sealed = await sealRecord(key, payload, { userId, chatId, recordId: localId });
  const row: OutboxRow = {
    local_id: localId,
    chat_id: chatId,
    user_id: userId,
    created_at: new Date().toISOString(),
    attempts: 0,
    next_attempt_at: 0,
    iv: sealed.iv,
    ct: sealed.ct,
  };
  await tx(STORE.outbox, 'readwrite', (s) => s.put(row));
  return localId;
}

export async function readOutbox<T = Record<string, unknown>>(
  userId: string,
): Promise<Array<{ row: OutboxRow; payload: T }>> {
  if (!cacheAvailable()) return [];
  const key = await getCacheKey(userId);
  if (!key) return [];
  const rows = await all<OutboxRow>(STORE.outbox, 'by_user', IDBKeyRange.only(userId));
  const out: Array<{ row: OutboxRow; payload: T }> = [];
  for (const r of rows) {
    const payload = await openRecord<T>(key, { iv: r.iv, ct: r.ct }, {
      userId,
      chatId: r.chat_id,
      recordId: r.local_id,
    });
    if (payload) out.push({ row: r, payload });
  }
  return out.sort((a, b) => a.row.created_at.localeCompare(b.row.created_at));
}

export async function updateOutboxAttempt(row: OutboxRow, delayMs: number): Promise<void> {
  const next: OutboxRow = {
    ...row,
    attempts: row.attempts + 1,
    next_attempt_at: Date.now() + delayMs,
  };
  await tx(STORE.outbox, 'readwrite', (s) => s.put(next));
}

export async function dequeueOutbox(localId: string): Promise<void> {
  if (!cacheAvailable()) return;
  await tx(STORE.outbox, 'readwrite', (s) => s.delete(localId));
}

// ----------------------------------------------------------------- media
export async function putMedia(
  userId: string,
  chatId: string,
  mediaKey: string,
  bytes: ArrayBuffer,
  mime: string,
): Promise<void> {
  const key = await getCacheKey(userId);
  if (!key) return;
  const sealed = await sealBytes(key, bytes, { userId, chatId, recordId: mediaKey });
  const row: MediaRow = {
    key: mediaKey,
    chat_id: chatId,
    user_id: userId,
    size: bytes.byteLength,
    last_used: Date.now(),
    mime,
    iv: sealed.iv,
    ct: sealed.ct,
  };
  await tx(STORE.media, 'readwrite', (s) => s.put(row));
}

export async function getMedia(
  userId: string,
  chatId: string,
  mediaKey: string,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (!cacheAvailable()) return null;
  const key = await getCacheKey(userId);
  if (!key) return null;
  const row = (await tx<MediaRow>(STORE.media, 'readonly', (s) => s.get(mediaKey))) as
    | MediaRow
    | undefined;
  if (!row) return null;
  const bytes = await openBytes(key, { iv: row.iv, ct: row.ct }, {
    userId,
    chatId,
    recordId: mediaKey,
  });
  if (!bytes) return null;
  await tx(STORE.media, 'readwrite', (s) => s.put({ ...row, last_used: Date.now() }));
  return { bytes, mime: row.mime };
}

/** LRU sweep down to the user's configured budget. 0 === unlimited. */
export async function sweepMedia(userId: string, limitMb: number): Promise<void> {
  if (!cacheAvailable() || !limitMb) return;
  const rows = await all<MediaRow>(STORE.media, 'by_user', IDBKeyRange.only(userId));
  const budget = limitMb * 1024 * 1024;
  let total = rows.reduce((n, r) => n + r.size, 0);
  if (total <= budget) return;
  const lru = rows.sort((a, b) => a.last_used - b.last_used);
  const drop: string[] = [];
  for (const r of lru) {
    if (total <= budget) break;
    drop.push(r.key);
    total -= r.size;
  }
  if (drop.length)
    await txMany(STORE.media, (s) => { for (const k of drop) s.delete(k); });
}

// ------------------------------------------------------------ secure wipe
/** Remove every cached record for one user (logout / manual clear). */
export async function wipeUserCache(userId: string): Promise<void> {
  if (!cacheAvailable()) return;
  for (const store of [STORE.chats, STORE.messages, STORE.outbox, STORE.media]) {
    const rows = await all<{ id?: string; local_id?: string; key?: string; user_id: string }>(
      store,
      'by_user',
      IDBKeyRange.only(userId),
    ).catch(() => []);
    if (rows.length)
      await txMany(store, (s) => {
        for (const r of rows) s.delete((r.id ?? r.local_id ?? r.key) as string);
      });
  }
  // chats store has no by_user index name collision — clear leftovers too
  const chatRows = await all<CachedChatRow>(
    STORE.chats,
    'by_user_updated',
    IDBKeyRange.bound([userId, ''], [userId, '\uffff']),
  ).catch(() => []);
  if (chatRows.length)
    await txMany(STORE.chats, (s) => { for (const r of chatRows) s.delete(r.id); });
}

/** Nuke the whole cache database (Maximum Privacy Mode logout). */
export async function destroyCacheDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    db.close();
  } catch {}
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export type { SealedRecord };
