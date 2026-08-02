/**
 * Outbox runner — the UX layer on top of the existing offline outbox.
 *
 * Queued messages are already sealed by `queueOutgoing`; this module only
 * decides *when* to retry and reports success/failure back to the UI so the
 * pending clock can flip to a delivered tick. No encryption or sync-algorithm
 * behaviour is changed here.
 */
import { supabase } from '@/integrations/supabase/client';
import { flushOutbox, pendingOutboxCount } from './sync-engine';
import { beginSync, endSync } from './connection';

let installedFor: string | null = null;
let disposer: (() => void) | null = null;
let running = false;

/** Insert one queued payload. Duplicate sends are prevented by the outbox
 *  dequeue + `client_local_id` echo in the dispatched event. */
async function sendQueued(payload: Record<string, unknown>): Promise<void> {
  const localId = String(payload.__local_id || '');
  const row = { ...payload };
  delete (row as Record<string, unknown>).__local_id;
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
        detail: { localId, chatId: row.chat_id, message: data },
      }),
    );
  }
}

/** Flush any queued messages. Safe to call repeatedly / concurrently. */
export async function runOutbox(userId: string): Promise<number> {
  if (running) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  const queued = await pendingOutboxCount(userId).catch(() => 0);
  if (!queued) return 0;
  running = true;
  beginSync();
  try {
    return await flushOutbox(userId, sendQueued);
  } catch {
    return 0;
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