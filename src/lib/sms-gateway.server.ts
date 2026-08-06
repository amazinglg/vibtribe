// Server-only helpers for the SMS verification gateway.
// Never import this from client code.
import { createClient } from '@supabase/supabase-js';

export const GATEWAY_NUMBER = '+918819877659';
export const DEFAULT_GATEWAY_ID = 'gw_primary';

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

const HEX = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford-ish, no I/L/O/U

/** Cryptographically secure, human-typable token (returned to the client once). */
export function generateToken(len = 10): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) out += HEX[buf[i] % HEX.length];
  return out;
}

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

/** SHA-256 hex of the normalised token. Only the hash is ever persisted. */
export async function hashToken(token: string): Promise<string> {
  const norm = token.trim().toUpperCase();
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vibtribe_sms_token:' + norm)));
}

/** Non-reversible short fingerprint, safe for logs. */
export function fingerprint(tokenHash: string): string {
  return tokenHash.slice(0, 8);
}

/** SHA-256 hex of a provisioned device secret. Only the hash is ever persisted. */
export async function hashDeviceSecret(secret: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vibtribe_gw_secret:' + secret.trim())),
  );
}

/** Generate a backend-owned device id, e.g. gw_5f3a9c1b7d2e4680. */
export function generateDeviceId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i++) s += buf[i].toString(16).padStart(2, '0');
  return 'gw_' + s;
}

/** Generate a high-entropy device secret (base64url, 32 random bytes). */
export function generateDeviceSecret(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/** Constant-time comparison of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
