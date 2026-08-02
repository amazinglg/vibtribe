/**
 * VibTribe offline cache — key management + record encryption.
 *
 * Threat model
 * ------------
 * Protects against: database extraction, filesystem copy, device backup
 * extraction and offline forensic analysis. Everything persisted is
 * AES-256-GCM ciphertext; the Cache Master Key (CMK) never lives in the
 * cache database.
 *
 * Accepted limitation (documented, by design): a rooted / jailbroken device
 * while the app is unlocked and the CMK is resident in memory. Every
 * mainstream messenger shares this bound.
 *
 * Key storage
 * -----------
 *  Android : Android Keystore (StrongBox preferred) via the `VtSecureStore`
 *            Capacitor plugin.
 *  iOS     : Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`)
 *            via the same plugin.
 *  Web/PWA : a non-extractable WebCrypto `CryptoKey` persisted in IndexedDB.
 *            The browser keeps the raw bytes opaque to JS.
 *
 * Optional PIN layer: when the user has an Encryption PIN, the CMK is
 * additionally wrapped with a PBKDF2-derived key. Caching is NEVER disabled
 * just because no PIN exists — platform storage is the baseline.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface VtSecureStorePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

let _plugin: VtSecureStorePlugin | null = null;
function VtSecureStoreLazy(): VtSecureStorePlugin {
  if (!_plugin) _plugin = registerPlugin<VtSecureStorePlugin>('VtSecureStore');
  return _plugin;
}

function hasNativeSecureStore(): boolean {
  try {
    return (
      !!Capacitor?.isNativePlatform?.() && Capacitor.isPluginAvailable('VtSecureStore')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- base64
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cryptoOk(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof indexedDB !== 'undefined';
}

// ------------------------------------------------------- key-store (web)
const KEY_DB = 'vibtribe-cache-keys';
const KEY_STORE = 'cmk';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const r = tx.objectStore(KEY_STORE).get(key);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ------------------------------------------------------------- PIN layer
let sessionPin: string | null = null;

/** Register the user's Encryption PIN for this session (optional layer). */
export function setCachePinLayer(pin: string | null): void {
  sessionPin = pin && /^\d{6}$/.test(pin) ? pin : null;
}

async function pinKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** `v1:<b64 raw>` or `v1p:<b64 salt>:<b64 iv>:<b64 wrapped>` */
async function packCmk(raw: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!sessionPin) return `v1:${bufToB64(raw)}`;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await pinKey(sessionPin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, raw);
  return `v1p:${bufToB64(salt)}:${bufToB64(iv)}:${bufToB64(new Uint8Array(ct))}`;
}

async function unpackCmk(packed: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (packed.startsWith('v1:')) return b64ToBuf(packed.slice(3));
  if (packed.startsWith('v1p:')) {
    if (!sessionPin) return null; // needs the PIN layer to open
    const [, s, i, c] = packed.split(':');
    try {
      const k = await pinKey(sessionPin, b64ToBuf(s));
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(i) },
        k,
        b64ToBuf(c),
      );
      return new Uint8Array(plain) as Uint8Array<ArrayBuffer>;
    } catch {
      return null;
    }
  }
  return null;
}

// ----------------------------------------------------------------- CMK
const memKeys = new Map<string, CryptoKey>();

async function importCmk(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Resolve (or lazily create) this device's Cache Master Key for `userId`.
 * Returns null when the runtime cannot provide secure crypto — callers must
 * then fall back to network-only rendering rather than caching in the clear.
 */
export async function getCacheKey(userId: string): Promise<CryptoKey | null> {
  if (!userId || !cryptoOk()) return null;
  const hit = memKeys.get(userId);
  if (hit) return hit;

  const storeKey = `vt_cmk_${userId}`;

  // Native: Keystore / Keychain holds the (optionally PIN-wrapped) CMK.
  if (hasNativeSecureStore()) {
    try {
      const existing = await VtSecureStoreLazy().get({ key: storeKey });
      if (existing?.value) {
        const raw = await unpackCmk(existing.value);
        if (raw) {
          const key = await importCmk(raw);
          memKeys.set(userId, key);
          return key;
        }
        return null; // PIN layer present but not unlocked yet
      }
      const raw = crypto.getRandomValues(new Uint8Array(32));
      await VtSecureStoreLazy().set({ key: storeKey, value: await packCmk(raw) });
      const key = await importCmk(raw);
      memKeys.set(userId, key);
      return key;
    } catch {
      /* fall through to the web path */
    }
  }

  // Web / PWA: a non-extractable CryptoKey, persisted opaquely by the browser.
  try {
    const stored = await idbGet<CryptoKey>(storeKey);
    if (stored) {
      memKeys.set(userId, stored);
      return stored;
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await idbPut(storeKey, key);
    memKeys.set(userId, key);
    return key;
  } catch {
    return null;
  }
}

/** Drop the decrypted CMK from memory (app backgrounded / privacy mode). */
export function forgetCacheKeyInMemory(userId?: string): void {
  if (userId) memKeys.delete(userId);
  else memKeys.clear();
  sessionPin = null;
}

/** Secure wipe of the wrapped CMK — logout, manual clear, remote logout. */
export async function destroyCacheKey(userId: string): Promise<void> {
  memKeys.delete(userId);
  const storeKey = `vt_cmk_${userId}`;
  if (hasNativeSecureStore()) {
    try { await VtSecureStoreLazy().remove({ key: storeKey }); } catch {}
  }
  try { await idbDel(storeKey); } catch {}
}

// ------------------------------------------------------- record crypto
export interface SealedRecord {
  iv: Uint8Array<ArrayBuffer>;
  ct: ArrayBuffer;
}

function aad(userId: string, chatId: string, recordId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${userId}|${chatId}|${recordId}`);
}

/** AES-256-GCM with a fresh IV per record and AAD bound to user/chat/record. */
export async function sealRecord(
  key: CryptoKey,
  value: unknown,
  ids: { userId: string; chatId: string; recordId: string },
): Promise<SealedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value)) as Uint8Array<ArrayBuffer>;
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(ids.userId, ids.chatId, ids.recordId) },
    key,
    data,
  );
  return { iv, ct };
}

export async function openRecord<T>(
  key: CryptoKey,
  sealed: SealedRecord,
  ids: { userId: string; chatId: string; recordId: string },
): Promise<T | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.iv, additionalData: aad(ids.userId, ids.chatId, ids.recordId) },
      key,
      sealed.ct,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

/** Binary variant used for cached media bytes. */
export async function sealBytes(
  key: CryptoKey,
  bytes: ArrayBuffer,
  ids: { userId: string; chatId: string; recordId: string },
): Promise<SealedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(ids.userId, ids.chatId, ids.recordId) },
    key,
    bytes,
  );
  return { iv, ct };
}

export async function openBytes(
  key: CryptoKey,
  sealed: SealedRecord,
  ids: { userId: string; chatId: string; recordId: string },
): Promise<ArrayBuffer | null> {
  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.iv, additionalData: aad(ids.userId, ids.chatId, ids.recordId) },
      key,
      sealed.ct,
    );
  } catch {
    return null;
  }
}
