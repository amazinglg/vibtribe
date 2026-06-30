/**
 * Client-side mobile-number hashing for DPDP-compliant contact sync.
 *
 * We never upload the raw phone numbers of the user's address book to the
 * server. Instead we SHA-256 each number's last 10 digits with a fixed
 * non-secret pepper and the server matches on the resulting hash column.
 *
 * The pepper MUST stay identical to the one in
 *   public.compute_mobile_hash() in the database, or matches will silently
 *   fail.
 */

const PEPPER = 'vibtribe_v1_contact_pepper:';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Hash a single phone number (any format). Returns null if too short. */
export async function hashMobile(input: string): Promise<string | null> {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 7) return null;
  const last10 = digits.slice(-10);
  const enc = new TextEncoder().encode(PEPPER + last10);
  const subtle =
    typeof crypto !== 'undefined' && (crypto as any).subtle
      ? (crypto as any).subtle
      : null;
  if (!subtle) {
    // Should never happen in a modern browser/WebView; fail closed.
    return null;
  }
  const buf = await subtle.digest('SHA-256', enc);
  return bytesToHex(new Uint8Array(buf));
}

/** Hash a list of phone numbers, returning the unique non-null hash set
 *  and a lookup map from hash → original last-10 digits (for re-joining
 *  match results to the original phonebook entries). */
export async function hashMobiles(numbers: string[]): Promise<{
  hashes: string[];
  byHash: Map<string, string>; // hash -> last10
  hashByLast10: Map<string, string>; // last10 -> hash
}> {
  const byHash = new Map<string, string>();
  const hashByLast10 = new Map<string, string>();
  for (const n of numbers) {
    const digits = String(n || '').replace(/\D/g, '');
    if (digits.length < 7) continue;
    const last10 = digits.slice(-10);
    if (hashByLast10.has(last10)) continue;
    const h = await hashMobile(last10);
    if (!h) continue;
    byHash.set(h, last10);
    hashByLast10.set(last10, h);
  }
  return { hashes: Array.from(byHash.keys()), byHash, hashByLast10 };
}