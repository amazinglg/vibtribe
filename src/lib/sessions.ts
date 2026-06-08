// Per-device session tracking for the Devices tab + targeted remote logout.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_ID_KEY = 'vt_device_id';
const SESSION_ID_KEY = 'vt_session_id';

function uuid() {
  // RFC4122-ish v4 — sufficient for an opaque device identifier.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    try { window.localStorage.setItem(DEVICE_ID_KEY, id); } catch {}
  }
  return id;
}

export function getCurrentSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_ID_KEY);
}

function setCurrentSessionId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(SESSION_ID_KEY, id);
    else window.localStorage.removeItem(SESSION_ID_KEY);
  } catch {}
}

function detectPlatform(): string {
  try {
    if (Capacitor?.getPlatform) {
      const p = Capacitor.getPlatform();
      if (p && p !== 'web') return p; // 'android' | 'ios'
    }
  } catch {}
  return 'web';
}

function detectDeviceName(platform: string): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent || '';
  if (platform === 'android') {
    // e.g. "Linux; Android 14; Pixel 7" — extract the device model
    const m = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    if (m) {
      const parts = m[1].split(';').map((s) => s.trim());
      const model = parts[parts.length - 1] || 'Android device';
      return `Android · ${model.replace(/Build\/.*$/i, '').trim()}`;
    }
    return 'Android device';
  }
  if (platform === 'ios') {
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    return 'iOS device';
  }
  // Web: derive browser + OS
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : 'Web';
  return `${browser} · ${os}`;
}

export async function registerSession(userId: string): Promise<void> {
  if (!userId) return;
  const platform = detectPlatform();
  const deviceId = getDeviceId();
  const payload = {
    user_id: userId,
    device_id: deviceId,
    device_name: detectDeviceName(platform),
    platform,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    app_version: (import.meta as any).env?.VITE_APP_VERSION || null,
    last_seen_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .upsert(payload, { onConflict: 'user_id,device_id' })
      .select('id')
      .maybeSingle();
    if (!error && data?.id) setCurrentSessionId(data.id);
  } catch (e) {
    console.warn('[sessions] register failed', e);
  }
}

export async function heartbeatSession(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from('user_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', getDeviceId());
  } catch {}
}

export async function deleteCurrentSession(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', getDeviceId());
  } catch {}
  setCurrentSessionId(null);
}

export type DeviceSession = {
  id: string;
  device_id: string;
  device_name: string;
  platform: string;
  user_agent: string | null;
  app_version: string | null;
  created_at: string;
  last_seen_at: string;
};

export async function listUserSessions(userId: string): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, device_id, device_name, platform, user_agent, app_version, created_at, last_seen_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DeviceSession[];
  // Dedupe: collapse rows that represent the same physical device.
  // Android WebView regenerates the localStorage device_id on app
  // reinstall / WebView data wipe, so a single phone can show up many times.
  // Keep only the most-recent row per (platform + device_name + UA hash).
  const seen = new Map<string, DeviceSession>();
  const myDeviceId = (typeof window !== 'undefined' && window.localStorage.getItem(DEVICE_ID_KEY)) || '';
  const mySessionId = getCurrentSessionId();
  const key = (r: DeviceSession) => {
    const ua = (r.user_agent || '').slice(0, 80);
    return `${r.platform}|${r.device_name}|${ua}`;
  };
  for (const r of rows) {
    const k = key(r);
    const existing = seen.get(k);
    if (!existing) { seen.set(k, r); continue; }
    // Always keep the row matching the current device/session so the
    // "Current" badge stays accurate.
    if (r.device_id === myDeviceId || r.id === mySessionId) seen.set(k, r);
  }
  // Drop rows older than 60 days — those devices haven't checked in for a long time.
  const CUTOFF = Date.now() - 60 * 24 * 60 * 60 * 1000;
  return Array.from(seen.values())
    .filter((r) => new Date(r.last_seen_at).getTime() >= CUTOFF)
    .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
}

// Force-logout a single device (or all when sessionId is null).
export async function forceLogoutSession(userId: string, sessionId: string | null): Promise<void> {
  const { error } = await supabase
    .from('force_logout_tokens')
    .insert({ user_id: userId, issued_by: userId, session_id: sessionId });
  if (error) throw error;
}