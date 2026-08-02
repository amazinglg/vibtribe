/**
 * Connection / sync state for the offline UX layer.
 *
 * Purely presentational: it observes the browser's online state plus
 * `vt-sync-start` / `vt-sync-end` events dispatched by the panels. It never
 * touches the sync algorithm, encryption or key management.
 */
import { useEffect, useState } from 'react';

export type ConnectionState = 'offline' | 'reconnecting' | 'syncing' | 'synced';

let activeSyncs = 0;

export function beginSync() {
  activeSyncs++;
  emit();
}

export function endSync() {
  activeSyncs = Math.max(0, activeSyncs - 1);
  emit();
}

function emit() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vt-sync-change', { detail: { activeSyncs } }));
}

function compute(reconnecting: boolean): ConnectionState {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (reconnecting) return 'reconnecting';
  return activeSyncs > 0 ? 'syncing' : 'synced';
}

/** Subtle, modern connection state for status pills. */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('synced');

  useEffect(() => {
    let reconnecting = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => setState(compute(reconnecting));

    const onOnline = () => {
      // Brief "Reconnecting…" beat before we claim we're back.
      reconnecting = true;
      update();
      clearTimeout(timer);
      timer = setTimeout(() => { reconnecting = false; update(); }, 1200);
    };
    const onOffline = () => { reconnecting = false; update(); };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('vt-sync-change', update);
    update();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('vt-sync-change', update);
    };
  }, []);

  return state;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}