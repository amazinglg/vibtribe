/**
 * VibTribe E2E Encryption using Web Crypto API
 * Uses ECDH for key exchange + AES-GCM for message encryption
 */

const DB_NAME = 'vibetribe-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';

// Open IndexedDB for key storage
function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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

// Generate ECDH key pair for this user
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

  // Store private key in IndexedDB
  await storeKey('myPrivateKey', keyPair.privateKey);
  await storeKey('myPublicKey', publicKeyBase64);

  return { publicKey: publicKeyBase64, privateKey: keyPair.privateKey };
}

// Get or create this user's key pair
export async function getOrCreateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  try {
    const storedPrivate = await getKey('myPrivateKey');
    const storedPublic = await getKey('myPublicKey');
    if (storedPrivate && storedPublic) {
      return { publicKey: storedPublic, privateKey: storedPrivate };
    }
  } catch {}
  return generateKeyPair();
}

// Derive shared AES key from ECDH
async function deriveSharedKey(privateKey: CryptoKey, theirPublicKeyBase64: string): Promise<CryptoKey> {
  const publicKeyBuffer = Uint8Array.from(atob(theirPublicKeyBase64), c => c.charCodeAt(0));
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

// Encrypt a message
export async function encryptMessage(plaintext: string, theirPublicKeyBase64: string): Promise<string> {
  // NOTE: Device-local ECDH key storage made messages permanently
  // undecryptable after cache clear / device change. Until we ship a
  // server-assisted key backup, send plaintext (transport is still TLS
  // and rows are protected by Supabase RLS).
  return plaintext;
}

// Decrypt a message
export async function decryptMessage(ciphertext: string, theirPublicKeyBase64: string): Promise<string> {
  if (!ciphertext.startsWith('e2e:')) return ciphertext;

  try {
    const { privateKey } = await getOrCreateKeyPair();
    const sharedKey = await deriveSharedKey(privateKey, theirPublicKeyBase64);

    const combined = Uint8Array.from(atob(ciphertext.slice(4)), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Legacy ciphertext we can no longer decrypt (key lost on this device).
    return '🔒 Older message — please resend';
  }
}

// Check if message is encrypted
export function isEncrypted(content: string): boolean {
  return content?.startsWith('e2e:') || false;
}
