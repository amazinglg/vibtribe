// Premium media save/share helpers. Works across PWA, desktop browsers,
// and Capacitor Android. Never silently fails — always throws a typed
// error the caller can surface.

import { isNativeWrapper } from '@/lib/native-bridge';
import { VtMedia, hasNativeMedia, isTrustLockRejection } from '@/lib/vt-media';

export class TrustLockError extends Error {
  constructor() {
    super('This media is protected by Trust Lock and cannot be shared.');
    this.name = 'TrustLockError';
  }
}

function extFromMime(mime: string): string {
  if (!mime) return '';
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
    'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
  };
  return map[mime.toLowerCase()] || '';
}

function ensureName(name: string | undefined, mime: string): string {
  const safe = (name || 'vibtribe-media').replace(/[\\/:*?"<>|]/g, '_');
  if (/\.[a-z0-9]{2,5}$/i.test(safe)) return safe;
  const ext = extFromMime(mime);
  return ext ? `${safe}.${ext}` : safe;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function resolveBlob(source: Blob | string): Promise<Blob> {
  if (source instanceof Blob) return source;
  const res = await fetch(source);
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.blob();
}

export type SaveResult = { location: 'gallery' | 'downloads' | 'browser' };

/**
 * Save media to the user's device using the best available path.
 * - Capacitor Android: Filesystem into ExternalStorage/{Pictures,Movies,Music,Download}/VibTribe/.
 * - PWA / desktop: File System Access API if available, else anchor download.
 */
export async function saveMedia(
  source: Blob | string,
  opts: { name?: string; mime: string },
): Promise<SaveResult> {
  const blob = await resolveBlob(source);
  const filename = ensureName(opts.name, opts.mime);

  // Preferred Android path: MediaStore insert via the native plugin so the
  // file actually lands in the phone's Gallery / Downloads.
  if (hasNativeMedia()) {
    try {
      const base64 = await blobToBase64(blob);
      const res = await VtMedia.save({ data: base64, mime: opts.mime || blob.type || 'application/octet-stream', name: filename });
      return { location: res?.location === 'downloads' ? 'downloads' : 'gallery' };
    } catch (e) {
      if (isTrustLockRejection(e)) throw new TrustLockError();
      console.warn('[VibTribe] VtMedia.save failed, falling back', e);
    }
  }

  if (isNativeWrapper()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      const mime = (opts.mime || '').toLowerCase();
      const isImage = mime.startsWith('image/');
      const isVideo = mime.startsWith('video/');
      const isAudio = mime.startsWith('audio/');
      const folder = isVideo ? 'Movies' : isAudio ? 'Music' : isImage ? 'Pictures' : 'Download';
      const path = `${folder}/VibTribe/${filename}`;
      try {
        await Filesystem.mkdir({ path: `${folder}/VibTribe`, directory: Directory.ExternalStorage, recursive: true });
      } catch { /* exists */ }
      await Filesystem.writeFile({ path, data: base64, directory: Directory.ExternalStorage, recursive: true });
      return { location: (isImage || isVideo || isAudio) ? 'gallery' : 'downloads' };
    } catch (e) {
      console.warn('[VibTribe] native save failed, falling back', e);
    }
  }

  const anyWin = window as any;
  if (anyWin.showSaveFilePicker) {
    try {
      const handle = await anyWin.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { location: 'downloads' };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { location: 'browser' };
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  }
}

/**
 * Native share via OS share sheet. Throws TrustLockError if disabled.
 */
export async function shareMedia(
  source: Blob | string,
  opts: { name?: string; mime: string; text?: string; trustLocked?: boolean },
): Promise<void> {
  if (opts.trustLocked) throw new TrustLockError();
  const blob = await resolveBlob(source);
  const filename = ensureName(opts.name, opts.mime);

  if (hasNativeMedia()) {
    try {
      const base64 = await blobToBase64(blob);
      await VtMedia.share({
        data: base64,
        mime: opts.mime || blob.type || 'application/octet-stream',
        name: filename,
        text: opts.text,
      });
      return;
    } catch (e) {
      if (isTrustLockRejection(e)) throw new TrustLockError();
      console.warn('[VibTribe] VtMedia.share failed, falling back', e);
    }
  }

  if (isNativeWrapper()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await Share.share({ title: opts.name || 'VibTribe', text: opts.text, url: uri, dialogTitle: 'Share via' });
      return;
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('cancel')) return;
      console.warn('[VibTribe] native share failed', e);
    }
  }

  if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
    try {
      const file = new File([blob], filename, { type: opts.mime });
      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: opts.name, text: opts.text });
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: opts.name, text: opts.text });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }

  await saveMedia(blob, { name: opts.name, mime: opts.mime });
  throw new Error('Sharing is not supported on this browser — file was saved instead.');
}

/**
 * Copy an actual image (bitmap, not a URL) to the system clipboard so it can
 * be pasted into another chat or app. Throws TrustLockError when blocked.
 */
export async function copyImageToClipboard(
  source: Blob | string,
  opts: { name?: string; mime?: string; trustLocked?: boolean },
): Promise<void> {
  if (opts.trustLocked) throw new TrustLockError();
  const blob = await resolveBlob(source);
  const mime = opts.mime || blob.type || 'image/png';
  const filename = ensureName(opts.name, mime);

  if (hasNativeMedia()) {
    try {
      const base64 = await blobToBase64(blob);
      await VtMedia.copyImage({ data: base64, mime, name: filename });
      return;
    } catch (e) {
      if (isTrustLockRejection(e)) throw new TrustLockError();
      console.warn('[VibTribe] VtMedia.copyImage failed, falling back', e);
    }
  }

  const anyNav = navigator as any;
  if (typeof ClipboardItem !== 'undefined' && anyNav?.clipboard?.write) {
    // Browsers only reliably accept image/png on the clipboard.
    const png = mime === 'image/png' ? blob : await toPngBlob(blob);
    await anyNav.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return;
  }
  throw new Error('Copying images is not supported on this device');
}

async function toPngBlob(blob: Blob): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = bitmapUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
