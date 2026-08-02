/**
 * Outbox runner — the UX layer on top of the existing offline outbox.
 *
 * Queued messages are already sealed by `queueOutgoing`; this module only
 * decides *when* to retry and reports success/failure back to the UI so the
 * pending clock can flip to a delivered tick. No encryption or sync-algorithm
 * behaviour is changed here.
 */
import { supabase } from '@/integrations/supabase/client';
import { readOutbox, dequeueOutbox, updateOutboxAttempt, deleteMessages } from './cache-db';
import { beginSync, endSync } from './connection';

let installedFor: string | null = null;
let disposer: (() => void) | null = null;
let running = false;

/** Display-only fields the UI attaches to a queued payload. */
const DISPLAY_KEYS = ['text', 'senderId', 'status', 'pending', 'id', 'created_at', 'time'];

async function sendQueued(localId: string, payload: Record<string, unknown>): Promise<void> {
  const row: Record<string, unknown> = { ...payload };
  for (const k of DISPLAY_KEYS) delete row[k];
  const { data, error } = await supabase
    .from('messages')
    .insert(row as never)
    .select()
    .single();
  if (error) throw error;
  if (data) {
    try {
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', String(row.chat_id));
    } catch {}
    window.dispatchEvent(
      new CustomEvent('vt-outbox-sent', {
        detail: { localId, chatId: row.chat_id, message: data, text: payload.text },
      }),
    );
  }
}

/** Flush any queued messages. Safe to call repeatedly / concurrently. */
export async function runOutbox(userId: string): Promise<number> {
  if (running) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  const queued = await readOutbox<Record<string, unknown>>(userId).catch(() => []);
  if (!queued.length) return 0;
  running = true;
  beginSync();
  let sent = 0;
  try {
    for (const item of queued) {
      if (item.row.next_attempt_at > Date.now()) continue;
      try {
        await sendQueued(item.row.local_id, item.payload);
        // Dequeue first so a retry can never send the same message twice.
        await dequeueOutbox(item.row.local_id);
        await deleteMessages([item.row.local_id]);
        sent++;
      } catch {
        const delay = Math.min(5 * 60_000, 2000 * 2 ** item.row.attempts);
        await updateOutboxAttempt(item.row, delay);
      }
    }
    return sent;
  } finally {
    running = false;
    endSync();
  }
}

/**
 * Retry queued sends when the network returns, the app resumes, or realtime
 * reconnects. Returns a disposer.
 */
export function installOutboxRetry(userId: string): () => void {
  if (typeof window === 'undefined') return () => {};
  if (installedFor === userId && disposer) return disposer;
  disposer?.();
  installedFor = userId;

  const kick = () => { void runOutbox(userId); };
  const onVisible = () => { if (document.visibilityState === 'visible') kick(); };

  window.addEventListener('online', kick);
  window.addEventListener('focus', kick);
  window.addEventListener('vt-app-resumed', kick);
  window.addEventListener('vt-realtime-reconnected', kick);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(kick, 30_000);
  kick();

  disposer = () => {
    clearInterval(interval);
    window.removeEventListener('online', kick);
    window.removeEventListener('focus', kick);
    window.removeEventListener('vt-app-resumed', kick);
    window.removeEventListener('vt-realtime-reconnected', kick);
    document.removeEventListener('visibilitychange', onVisible);
    installedFor = null;
    disposer = null;
  };
  return disposer;
}