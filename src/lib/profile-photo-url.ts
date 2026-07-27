import { supabase } from '@/integrations/supabase/client';

// The `profile-photos` bucket is PRIVATE so that the owner's
// profile_photo_visibility ('all' | 'contacts' | 'selected') is actually
// enforced by storage RLS instead of being bypassable via a guessable public
// URL. Legacy values stored in the DB are still `.../object/public/profile-photos/<path>`
// URLs, so we transparently convert any such URL into a short-lived signed URL.

const MARKER = '/profile-photos/';
const SIGN_TTL_SECONDS = 60 * 60; // 1 hour
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

export function extractProfilePhotoPath(input: string): string | null {
  if (!input) return null;
  if (input.startsWith('blob:') || input.startsWith('data:')) return null;
  if (/\/storage\/v1\/object\/sign\//.test(input)) return null;
  const idx = input.indexOf(MARKER);
  if (idx === -1) return null;
  const tail = input.slice(idx + MARKER.length);
  const stop = tail.search(/[?#]/);
  const raw = stop === -1 ? tail : tail.slice(0, stop);
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export async function signProfilePhotoUrl(input: string): Promise<string> {
  const path = extractProfilePhotoPath(input);
  if (!path) return input;

  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now + 30_000) return hit.url;

  const existing = inflight.get(path);
  if (existing) return existing;

  const p = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from('profile-photos')
        .createSignedUrl(path, SIGN_TTL_SECONDS);
      if (error || !data?.signedUrl) return input;
      cache.set(path, { url: data.signedUrl, expires: Date.now() + SIGN_TTL_SECONDS * 1000 });
      return data.signedUrl;
    } catch {
      return input;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

export function clearProfilePhotoUrlCache() {
  cache.clear();
  inflight.clear();
}

// ---------------------------------------------------------------------------
// Global auto-signer: profile photos are rendered from dozens of surfaces
// (chat list, calls, tribes, admin, status, search...). Instead of touching
// every call site, we observe the DOM and swap any legacy public
// profile-photos URL on an <img> for a signed one.
// ---------------------------------------------------------------------------

const ATTR = 'data-vt-signed';

function processImg(img: HTMLImageElement) {
  const src = img.getAttribute('src');
  if (!src) return;
  if (img.getAttribute(ATTR) === src) return;
  const path = extractProfilePhotoPath(src);
  if (!path) return;
  img.setAttribute(ATTR, src);
  void signProfilePhotoUrl(src).then((signed) => {
    if (signed && signed !== src && img.getAttribute('src') === src) {
      img.setAttribute(ATTR, signed);
      img.src = signed;
    }
  });
}

function scan(root: ParentNode) {
  root.querySelectorAll?.('img').forEach((el) => processImg(el as HTMLImageElement));
}

let installed = false;

export function installProfilePhotoSigner() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  scan(document);

  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'attributes' && rec.target instanceof HTMLImageElement) {
        processImg(rec.target);
        continue;
      }
      rec.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) processImg(node);
        else if (node instanceof HTMLElement) scan(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}
