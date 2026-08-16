/**
 * Bridge to the native VtMedia Android plugin (save to gallery, OS share
 * sheet, and true image-to-clipboard). Falls back gracefully on web.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface VtMediaPlugin {
  save(options: { data: string; mime: string; name?: string }): Promise<{ location: 'gallery' | 'downloads' }>;
  share(options: { data: string; mime: string; name?: string; text?: string }): Promise<void>;
  copyImage(options: { data: string; mime: string; name?: string }): Promise<void>;
  open(options: { data: string; mime: string; name?: string }): Promise<void>;
}

export const VtMedia = registerPlugin<VtMediaPlugin>('VtMedia');

export function hasNativeMedia(): boolean {
  try {
    return !!Capacitor?.isNativePlatform?.() && Capacitor.isPluginAvailable('VtMedia');
  } catch {
    return false;
  }
}

export function isTrustLockRejection(e: unknown): boolean {
  const msg = String((e as any)?.message || e || '');
  return msg.includes('TRUST_LOCK');
}