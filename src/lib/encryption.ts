// @ts-nocheck
/**
 * VibTribe E2E Encryption using Web Crypto API
 * Uses ECDH (P-256) for key exchange + AES-GCM for message encryption.
 * Private keys are wrapped with a PIN-derived AES key (PBKDF2) and stored
 * encrypted in the database so users can restore on new devices.
 */

import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'vibetribe-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';

/**
 * Verify the runtime has the crypto primitives we need. Throws a
 * human-readable error when something is missing — typically inside an
 * Android WebView served over http:// (Capacitor without
 * `androidScheme: 'https'`) where `crypto.subtle` is undefined.
 */
function assertCryptoAvailable(): void {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      "Secure crypto APIs are unavailable in this WebView. " +
      "If you're using the Android app, make sure it loads VibTribe over HTTPS " +
      "(Capacitor: set server.androidScheme = 'https')."
    );
  }
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable in this WebView — encryption cannot be unlocked.');
  }
}

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeKey(key: string, value: any): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getKey(key: string): Promise<any> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteKey(key: string): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Wipe locally cached private key (used on too-many-failed-attempts lockout). */
export async function clearLocalKey(): Promise<void> {
  try { await deleteKey('myPrivateKey'); } catch {}
  try { await deleteKey('myPublicKey'); } catch {}
}

// ---------------- Base64 helpers ----------------
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------- PIN -> AES key wrap ----------------
async function deriveWrapKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  assertCryptoAvailable();
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

// ---------------- Generate + upload (first-time PIN setup) ----------------
export async function setupEncryptionWithPIN(userId: string, pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be exactly 6 digits');

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  ) as CryptoKeyPair;

  const publicKeyBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveWrapKey(pin, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, privateKeyBuf);

  const publicKeyB64 = bufToB64(publicKeyBuf);

  const { error } = await supabase.from('user_profiles').update({
    public_key: publicKeyB64,
    encrypted_private_key: bufToB64(encrypted),
    key_salt: bufToB64(salt),
    key_iv: bufToB64(iv),
    key_setup_completed: true,
  }).eq('id', userId);
  if (error) throw error;

  // Cache locally (importKey to get a non-extractable usable key)
  const usablePrivate = await crypto.subtle.importKey(
    'pkcs8', privateKeyBuf, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']
  );
  await storeKey('myPrivateKey', usablePrivate);
  await storeKey('myPublicKey', publicKeyB64);
}

// ---------------- Unlock on new device ----------------
export async function unlockEncryptionWithPIN(userId: string, pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be exactly 6 digits');
  const { data: rows, error } = await supabase.rpc('get_my_encryption_material');
  if (error) throw error;
  const data = Array.isArray(rows) ? rows[0] : rows;
  if (!data?.encrypted_private_key || !data.key_salt || !data.key_iv || !data.public_key) {
    throw new Error('No encryption key found on server. Please set up encryption first.');
  }
  const salt = b64ToBuf(data.key_salt);
  const iv = b64ToBuf(data.key_iv);
  const wrapKey = await deriveWrapKey(pin, salt);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, wrapKey, b64ToBuf(data.encrypted_private_key)
    );
  } catch {
    throw new Error('Incorrect PIN');
  }
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', plainBuf, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']
  );
  await storeKey('myPrivateKey', privateKey);
  await storeKey('myPublicKey', data.public_key);
}

// ---------------- Change PIN (re-wrap the private key) ----------------
export async function changeEncryptionPIN(userId: string, oldPin: string, newPin: string): Promise<void> {
  if (!/^\d{6}$/.test(newPin)) throw new Error('New PIN must be exactly 6 digits');

  const { data: rows, error } = await supabase.rpc('get_my_encryption_material');
  if (error) throw error;
  const data = Array.isArray(rows) ? rows[0] : rows;
  if (!data?.encrypted_private_key || !data.key_salt || !data.key_iv) {
    throw new Error('No encryption key found. Please set up encryption first.');
  }

  // Decrypt with old PIN
  const oldSalt = b64ToBuf(data.key_salt);
  const oldIv = b64ToBuf(data.key_iv);
  const oldWrapKey = await deriveWrapKey(oldPin, oldSalt);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: oldIv }, oldWrapKey, b64ToBuf(data.encrypted_private_key)
    );
  } catch {
    throw new Error('Current PIN is incorrect');
  }

  // Re-encrypt with new PIN + fresh salt/iv
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newIv = crypto.getRandomValues(new Uint8Array(12));
  const newWrapKey = await deriveWrapKey(newPin, newSalt);
  const reEncrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: newIv }, newWrapKey, plainBuf);

  const { error: upErr } = await supabase.from('user_profiles').update({
    encrypted_private_key: bufToB64(reEncrypted),
    key_salt: bufToB64(newSalt),
    key_iv: bufToB64(newIv),
  }).eq('id', userId);
  if (upErr) throw upErr;
}

// ---------------- Status helpers ----------------
export async function hasLocalPrivateKey(): Promise<boolean> {
  try {
    const k = await getKey('myPrivateKey');
    return !!k;
  } catch { return false; }
}

export async function hasServerKey(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('key_setup_completed')
    .eq('id', userId)
    .single();
  return !!data?.key_setup_completed;
}

// Get this user's key pair from local cache only (no auto-generation now —
// keys are created via setupEncryptionWithPIN).
export async function getOrCreateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const storedPrivate = await getKey('myPrivateKey');
  const storedPublic = await getKey('myPublicKey');
  if (!storedPrivate || !storedPublic) {
    throw new Error('Encryption not unlocked on this device');
  }
  return { publicKey: storedPublic, privateKey: storedPrivate };
}

// Derive shared AES key from ECDH
async function deriveSharedKey(privateKey: CryptoKey, theirPublicKeyBase64: string): Promise<CryptoKey> {
  const publicKeyBuffer = b64ToBuf(theirPublicKeyBase64);
  const theirPublicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a message — real E2E (sender's private key + recipient's public key).
export async function encryptMessage(plaintext: string, theirPublicKeyBase64: string): Promise<string> {
  // Strict E2E: never fall back to plaintext. If the local key isn't
  // unlocked or the recipient's key is missing, the caller MUST block
  // the send and prompt the user to set up / unlock encryption.
  const { privateKey } = await getOrCreateKeyPair();
  const sharedKey = await deriveSharedKey(privateKey, theirPublicKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + (ct as ArrayBuffer).byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct as ArrayBuffer), iv.length);
  return 'e2e:' + bufToB64(combined);
}

// Decrypt a message
export async function decryptMessage(ciphertext: string, theirPublicKeyBase64: string): Promise<string> {
  if (!ciphertext.startsWith('e2e:')) return ciphertext;

  try {
    const { privateKey } = await getOrCreateKeyPair();
    const sharedKey = await deriveSharedKey(privateKey, theirPublicKeyBase64);

    const combined = b64ToBuf(ciphertext.slice(4));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Could not decrypt: either wrong key on device, or message was sent
    // before this user had a key. Show a friendly placeholder.
    return '🔒 Message locked — unlock encryption to read';
  }
}

// Check if message is encrypted
export function isEncrypted(content: string): boolean {
  return content?.startsWith('e2e:') || false;
}

// ---------------- Binary (media) encryption ----------------
// Encrypt a raw byte buffer with the shared ECDH key. Returns iv||ciphertext.
export async function encryptBytes(
  bytes: ArrayBuffer,
  theirPublicKeyBase64: string,
): Promise<ArrayBuffer> {
  const { privateKey } = await getOrCreateKeyPair();
  const sharedKey = await deriveSharedKey(privateKey, theirPublicKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, bytes);
  const out = new Uint8Array(iv.length + (ct as ArrayBuffer).byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct as ArrayBuffer), iv.length);
  return out.buffer;
}

// Decrypt a buffer produced by encryptBytes.
export async function decryptBytes(
  cipherBuf: ArrayBuffer,
  theirPublicKeyBase64: string,
): Promise<ArrayBuffer> {
  const { privateKey } = await getOrCreateKeyPair();
  const sharedKey = await deriveSharedKey(privateKey, theirPublicKeyBase64);
  const all = new Uint8Array(cipherBuf);
  const iv = all.slice(0, 12);
  const data = all.slice(12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, data);
}

// ---------------- Group E2E (per-recipient envelope) ----------------
// Envelope format:  g2e:<base64(JSON { iv, ct, keys: { [userId]: wrapped } })>
// - A fresh random AES-256 message key K encrypts the plaintext once.
// - K is then wrapped once per member using ECDH(myPriv, memberPub) + AES-GCM.
// - The same 6-digit PIN unlocks each user's private key from IndexedDB, so
//   no extra PIN is needed for groups.

export type GroupMember = { userId: string; publicKey: string };

export function isGroupEncrypted(content: string): boolean {
  return typeof content === 'string' && content.startsWith('g2e:');
}

// ---------------- Group media (random AES key, wrapped via group text) ----------------
// Strategy: encrypt the file once with a fresh random AES-256 key K, upload
// the ciphertext to storage, and ship K inside the per-recipient group text
// envelope (g2e:) so every member can decrypt the bytes without re-uploading.
export async function encryptBytesWithRandomKey(
  bytes: ArrayBuffer,
): Promise<{ keyB64: string; cipher: ArrayBuffer }> {
  assertCryptoAvailable();
  const msgKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, msgKey, bytes);
  const out = new Uint8Array(12 + (ct as ArrayBuffer).byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct as ArrayBuffer), 12);
  const raw = await crypto.subtle.exportKey('raw', msgKey);
  return { keyB64: bufToB64(raw), cipher: out.buffer };
}

export async function decryptBytesWithKey(
  cipherBuf: ArrayBuffer,
  keyB64: string,
): Promise<ArrayBuffer> {
  assertCryptoAvailable();
  const raw = b64ToBuf(keyB64);
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const all = new Uint8Array(cipherBuf);
  const iv = all.slice(0, 12);
  const data = all.slice(12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function encryptGroupMessage(
  plaintext: string,
  members: GroupMember[],
): Promise<string> {
  const { privateKey } = await getOrCreateKeyPair();
  // Generate fresh message key K
  const msgKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const rawK = await crypto.subtle.exportKey('raw', msgKey);

  // Encrypt plaintext with K
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    msgKey,
    new TextEncoder().encode(plaintext),
  );

  // Wrap K per recipient
  const keys: Record<string, string> = {};
  for (const m of members) {
    if (!m.publicKey || !m.userId) continue;
    try {
      const shared = await deriveSharedKey(privateKey, m.publicKey);
      const wIv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: wIv },
        shared,
        rawK,
      );
      const combined = new Uint8Array(12 + (wrapped as ArrayBuffer).byteLength);
      combined.set(wIv, 0);
      combined.set(new Uint8Array(wrapped as ArrayBuffer), 12);
      keys[m.userId] = bufToB64(combined);
    } catch {
      // Skip member whose key is unusable.
    }
  }

  const envelope = {
    iv: bufToB64(iv),
    ct: bufToB64(new Uint8Array(ctBuf as ArrayBuffer)),
    keys,
  };
  return 'g2e:' + bufToB64(new TextEncoder().encode(JSON.stringify(envelope)));
}

export async function decryptGroupMessageForMe(
  ciphertext: string,
  myUserId: string,
  senderPublicKeyBase64: string,
): Promise<string> {
  if (!ciphertext.startsWith('g2e:')) return ciphertext;
  try {
    const { privateKey } = await getOrCreateKeyPair();
    const json = new TextDecoder().decode(b64ToBuf(ciphertext.slice(4)));
    const env = JSON.parse(json) as {
      iv: string;
      ct: string;
      keys: Record<string, string>;
    };
    const wrappedB64 = env.keys?.[myUserId];
    if (!wrappedB64) return '🔒 Not addressed to you in this tribe';

    const shared = await deriveSharedKey(privateKey, senderPublicKeyBase64);
    const combined = b64ToBuf(wrappedB64);
    const wIv = combined.slice(0, 12);
    const wCt = combined.slice(12);
    const rawK = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: wIv },
      shared,
      wCt,
    );
    const msgKey = await crypto.subtle.importKey(
      'raw',
      rawK,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const iv = b64ToBuf(env.iv);
    const ctBuf = b64ToBuf(env.ct);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      msgKey,
      ctBuf,
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '🔒 Message locked — unlock encryption to read';
  }
}
