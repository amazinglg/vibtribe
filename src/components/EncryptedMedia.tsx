// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { decryptBytes, decryptBytesWithKey } from '@/lib/encryption';
import { signChatMediaUrl } from '@/lib/chat-media-url';
import { FileText, Loader2, AlertTriangle, X, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTrustLock } from '@/contexts/TrustLockContext';
import { saveMedia, shareMedia, TrustLockError } from '@/lib/media-actions';
import MediaActionButton from '@/components/MediaActionButton';
import TrustLockBlockedDialog from '@/components/TrustLockBlockedDialog';

interface Props {
  url: string;
  mime: string;
  name?: string;
  kind: 'image' | 'file' | 'audio' | 'video';
  theirPublicKey?: string;
  mediaKey?: string;
  onImageClick?: (blobUrl: string) => void;
}

const blobCache = new Map<string, string>();
const rawCache = new Map<string, Blob>();

export default function EncryptedMedia({ url, mime, name, kind, theirPublicKey, mediaKey, onImageClick }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(blobCache.get(url) || null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(!blobCache.has(url));
  const [showPreview, setShowPreview] = useState(false);
  const [showTrustBlock, setShowTrustBlock] = useState(false);
  const trustLock = useTrustLock();
  const trustLocked = trustLock.enabled;

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
        const signed = await signChatMediaUrl(url);
        const res = await fetch(signed);
        if (!res.ok) throw new Error('fetch failed');
        const cipher = await res.arrayBuffer();
        const plain = mediaKey
          ? await decryptBytesWithKey(cipher, mediaKey)
          : await decryptBytes(cipher, theirPublicKey as string);
        const blob = new Blob([plain], { type: mime || 'application/octet-stream' });
        const u = URL.createObjectURL(blob);
        blobCache.set(url, u);
        rawCache.set(url, blob);
        if (!cancelled) { setBlobUrl(u); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, mime, theirPublicKey, mediaKey]);

  const getBlob = async (): Promise<Blob> => {
    const cached = rawCache.get(url);
    if (cached) return cached;
    const res = await fetch(blobUrl!);
    return res.blob();
  };

  const runDownload = async () => {
    if (trustLocked) { setShowTrustBlock(true); throw new Error('Trust Lock enabled'); }
    const blob = await getBlob();
    return saveMedia(blob, { name, mime });
  };

  const runShare = async () => {
    if (trustLocked) { setShowTrustBlock(true); throw new Error('Trust Lock enabled'); }
    try {
      const blob = await getBlob();
      await shareMedia(blob, { name, mime });
    } catch (e) {
      if (e instanceof TrustLockError) { setShowTrustBlock(true); return; }
      throw e;
    }
  };

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

  const ActionCluster = ({ position = 'absolute' }: { position?: 'absolute' | 'inline' }) => (
    <div className={position === 'absolute' ? 'absolute top-2 right-2 flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
      {!trustLocked && (
        <>
          <MediaActionButton action="download" label="Download" onRun={runDownload} />
          <MediaActionButton action="share" label="Share" onRun={runShare} />
        </>
      )}
      {trustLocked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowTrustBlock(true); }}
          aria-label="Trust Lock protected"
          className="p-2 rounded-full bg-black/60 text-primary backdrop-blur-md border border-primary/40"
          title="Protected by Trust Lock"
        >
          <span aria-hidden>🛡️</span>
        </button>
      )}
    </div>
  );

  if (kind === 'image') {
    return (
      <>
        <div className="relative inline-block group">
          <img
            src={blobUrl}
            alt={name || 'Shared image'}
            className={`max-w-[200px] rounded-xl cursor-zoom-in ${trustLocked ? 'select-none' : ''}`}
            onClick={() => onImageClick?.(blobUrl)}
            onContextMenu={trustLocked ? (e) => e.preventDefault() : undefined}
            draggable={trustLocked ? false : undefined}
          />
          <ActionCluster />
        </div>
        <TrustLockBlockedDialog open={showTrustBlock} onClose={() => setShowTrustBlock(false)} />
      </>
    );
  }
  if (kind === 'audio') {
    return (
      <>
        <div className="flex items-center gap-2">
          <audio
            controls
            src={blobUrl}
            className="max-w-[200px]"
            controlsList={trustLocked ? 'nodownload noplaybackrate' : undefined}
            onContextMenu={trustLocked ? (e) => e.preventDefault() : undefined}
          />
          <ActionCluster position="inline" />
        </div>
        <TrustLockBlockedDialog open={showTrustBlock} onClose={() => setShowTrustBlock(false)} />
      </>
    );
  }
  if (kind === 'video') {
    return (
      <>
        <div className="relative inline-block">
          <video
            controls
            playsInline
            src={blobUrl}
            className="max-w-[240px] rounded-xl"
            controlsList={trustLocked ? 'nodownload noplaybackrate' : undefined}
            onContextMenu={trustLocked ? (e) => e.preventDefault() : undefined}
            disablePictureInPicture={trustLocked ? true : undefined}
          />
          <ActionCluster />
        </div>
        <TrustLockBlockedDialog open={showTrustBlock} onClose={() => setShowTrustBlock(false)} />
      </>
    );
  }

  // File / document
  const isPdfLike = /pdf/i.test(mime || '');
  const isImageDoc = /^image\//i.test(mime || '');
  const isTextDoc = /text\/|json|xml/i.test(mime || '');
  const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
  const canIframe = !isNative && (isPdfLike || isImageDoc || isTextDoc);

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
              <ActionCluster position="inline" />
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
                <p className="text-xs text-muted-foreground mb-4">
                  {trustLocked
                    ? '🛡️ Trust Lock is enabled — downloads are disabled in this chat.'
                    : 'Preview is not available for this file type. Tap Download to save it to your device.'}
                </p>
                {!trustLocked && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try { await runDownload(); toast.success('Saved to your device'); }
                      catch (err: any) { if (err?.name !== 'AbortError') toast.error(err?.message || 'Download failed'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
                  >
                    <Download size={16} /> Download
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <TrustLockBlockedDialog open={showTrustBlock} onClose={() => setShowTrustBlock(false)} />
    </>
  );
}
