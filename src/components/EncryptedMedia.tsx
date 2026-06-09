// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { decryptBytes, decryptBytesWithKey } from '@/lib/encryption';
import { Download, FileText, Loader2, AlertTriangle, X, Eye } from 'lucide-react';
import { isNativeWrapper } from '@/lib/native-bridge';
import { toast } from 'sonner';

interface Props {
  url: string;
  mime: string;
  name?: string;
  kind: 'image' | 'file' | 'audio' | 'video';
  /** Sender's ECDH public key (1:1 chats). Required if mediaKey is not set. */
  theirPublicKey?: string;
  /** Raw AES key (base64) shipped in the group envelope. Used for group media. */
  mediaKey?: string;
  onImageClick?: (blobUrl: string) => void;
}

// Tiny in-memory cache so a re-render doesn't re-fetch & re-decrypt.
const blobCache = new Map<string, string>();

export default function EncryptedMedia({ url, mime, name, kind, theirPublicKey, mediaKey, onImageClick }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(blobCache.get(url) || null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(!blobCache.has(url));
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (blobCache.has(url)) {
      setBlobUrl(blobCache.get(url)!);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const cipher = await res.arrayBuffer();
        const plain = mediaKey
          ? await decryptBytesWithKey(cipher, mediaKey)
          : await decryptBytes(cipher, theirPublicKey as string);
        const blob = new Blob([plain], { type: mime || 'application/octet-stream' });
        const u = URL.createObjectURL(blob);
        blobCache.set(url, u);
        if (!cancelled) { setBlobUrl(u); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, mime, theirPublicKey, mediaKey]);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle size={14} className="text-vt-amber" />
        🔒 Locked media — unlock encryption to view
      </div>
    );
  }
  if (loading || !blobUrl) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Decrypting…
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className="relative inline-block group">
        <img
          src={blobUrl}
          alt={name || 'Shared image'}
          className="max-w-[200px] rounded-xl cursor-zoom-in"
          onClick={() => onImageClick?.(blobUrl)}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadFile(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white opacity-80 hover:opacity-100"
          aria-label="Download image"
        >
          <Download size={14} />
        </button>
      </div>
    );
  }
  if (kind === 'audio') {
    return (
      <div className="flex items-center gap-2">
        <audio controls src={blobUrl} className="max-w-[200px]" />
        <button
          type="button"
          onClick={downloadFile}
          className="p-1.5 rounded-full bg-muted text-foreground"
          aria-label="Download audio"
        >
          <Download size={14} />
        </button>
      </div>
    );
  }
  if (kind === 'video') {
    return (
      <div className="relative inline-block">
        <video
          controls
          playsInline
          src={blobUrl}
          className="max-w-[240px] rounded-xl"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadFile(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white opacity-80 hover:opacity-100"
          aria-label="Download video"
        >
          <Download size={14} />
        </button>
      </div>
    );
  }
  // File / document: clicking opens a preview modal with a download button.
  const downloadFile = async () => {
    try {
      const res = await fetch(blobUrl!);
      const blob = await res.blob();
      if (isNativeWrapper()) {
        // Android WebView ignores blob: anchor downloads. Convert to a
        // data: URL so the WebView's DownloadListener (registered in
        // MainActivity) can save it via the system DownloadManager.
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = name || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const a = document.createElement('a');
        a.href = blobUrl!;
        a.download = name || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      toast.success('Saved to your downloads');
    } catch (e) {
      console.warn('[VibTribe] download failed', e);
      toast.error('Download failed');
    }
  };

  // Android WebView cannot render PDFs from blob: / data: URLs inside an
  // iframe — it just shows a blank white page. Skip the iframe on native and
  // surface a clean Download CTA instead.
  const isPdfLike = /pdf/i.test(mime || '');
  const isImageDoc = /^image\//i.test(mime || '');
  const isTextDoc = /text\/|json|xml/i.test(mime || '');
  const canIframe = !isNativeWrapper() && (isPdfLike || isImageDoc || isTextDoc);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="flex items-center gap-2 text-sm hover:underline"
      >
        <FileText size={16} />
        <span className="truncate max-w-[160px] text-left">{name || 'file'}</span>
        <Eye size={14} className="opacity-70" />
      </button>

      {showPreview && (
        <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex flex-col p-3" onClick={() => setShowPreview(false)}>
          <div className="flex items-center justify-between mb-3 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} />
              <span className="truncate text-sm">{name || 'file'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); downloadFile(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold"
              >
                <Download size={14} /> Download
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
                className="p-1.5 rounded-lg bg-white/10 text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {canIframe ? (
              <iframe src={blobUrl} title={name || 'preview'} className="w-full h-full border-0" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-foreground">
                <FileText size={48} className="text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1 break-all">{name || 'file'}</p>
                <p className="text-xs text-muted-foreground mb-4">Preview is not available for this file type. Tap Download to save it to your device.</p>
                <button
                  onClick={downloadFile}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
                >
                  <Download size={16} /> Download
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}