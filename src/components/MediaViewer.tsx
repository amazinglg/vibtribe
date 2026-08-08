import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import { signChatMediaUrl } from '@/lib/chat-media-url';
import { useTrustLock } from '@/contexts/TrustLockContext';
import MediaActionButton from '@/components/MediaActionButton';
import TrustLockBlockedDialog from '@/components/TrustLockBlockedDialog';
import { saveMedia, shareMedia, copyImageToClipboard, TrustLockError } from '@/lib/media-actions';

export interface ViewerSource {
  /** blob:, data:, raw chat-media path or legacy public URL */
  src: string;
  /** Bounding rect of the thumbnail that was tapped (shared-element origin) */
  rect?: { top: number; left: number; width: number; height: number } | null;
  name?: string;
  mime?: string;
  /** Already-decrypted bytes, when the caller has them (Capacitor safe). */
  blob?: Blob | null;
}

interface Props {
  source: ViewerSource | null;
  onClose: () => void;
}

/**
 * Wave 3 — premium media viewer.
 * Shared-element open/close from the tapped thumbnail, pinch + double-tap
 * zoom, pan while zoomed, drag-to-dismiss, and Trust Lock aware actions.
 */
export default function MediaViewer({ source, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [showTrustBlock, setShowTrustBlock] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const trustLock = useTrustLock();
  const trustLocked = trustLock.enabled;
  const hideTimerRef = useRef<number | null>(null);

  /** Show the action bar and auto-hide it again after 3 seconds. */
  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setChromeVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (!source) return;
    revealChrome();
    return () => { if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); };
  }, [source, revealChrome]);

  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [-320, 0, 320], [0, 1, 0]);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const lastTapRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setZoomed(false);
    scale.set(1); x.set(0); y.set(0); dragY.set(0);
    if (!source?.src) { setUrl(null); return; }
    const s = source.src;
    if (s.startsWith('blob:') || s.startsWith('data:')) { setUrl(s); return; }
    signChatMediaUrl(s).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.src]);

  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, onClose]);

  const setZoom = useCallback((next: number) => {
    const clamped = Math.min(4, Math.max(1, next));
    animate(scale, clamped, { type: 'spring', stiffness: 320, damping: 30 });
    if (clamped === 1) {
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 320, damping: 30 });
    }
    setZoomed(clamped > 1);
  }, [scale, x, y]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      setZoom(scale.get() > 1 ? 1 : 2.5);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        startScale: scale.get(),
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.min(4, Math.max(1, (dist / pinchRef.current.startDist) * pinchRef.current.startScale));
      scale.set(next);
      setZoomed(next > 1.02);
    }
  };
  const onTouchEnd = () => {
    if (pinchRef.current) {
      pinchRef.current = null;
      if (scale.get() < 1.05) setZoom(1);
    }
  };

  const fetchBlob = async (): Promise<Blob> => {
    // Prefer bytes the caller already decrypted — fetching a blob: URL can
    // fail inside the Capacitor WebView once the object URL is recycled.
    if (source?.blob) return source.blob;
    if (!url) throw new Error('Media is still loading');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('bad_status');
      return await res.blob();
    } catch {
      // Last resort: re-encode the rendered bitmap from the DOM.
      const img = imgRef.current;
      if (img?.naturalWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const b = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
          if (b) return b;
        }
      }
      throw new Error('Failed to load media');
    }
  };

  const runDownload = async () => {
    if (trustLocked) { setShowTrustBlock(true); throw new Error('Trust Lock enabled'); }
    const blob = await fetchBlob();
    return saveMedia(blob, { name: source?.name, mime: source?.mime || blob.type });
  };
  const runShare = async () => {
    if (trustLocked) { setShowTrustBlock(true); throw new Error('Trust Lock enabled'); }
    try {
      const blob = await fetchBlob();
      await shareMedia(blob, { name: source?.name, mime: source?.mime || blob.type });
    } catch (e) {
      if (e instanceof TrustLockError) { setShowTrustBlock(true); return; }
      throw e;
    }
  };

  const runCopy = async () => {
    if (trustLocked) { setShowTrustBlock(true); throw new Error('Trust Lock enabled'); }
    try {
      const blob = await fetchBlob();
      await copyImageToClipboard(blob, { name: source?.name, mime: source?.mime || blob.type });
    } catch (e) {
      if (e instanceof TrustLockError) { setShowTrustBlock(true); return; }
      throw e;
    }
  };

  const rect = source?.rect;
  const origin = rect
    ? {
        opacity: 0,
        scale: 0.7,
        x: rect.left + rect.width / 2 - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0),
        y: rect.top + rect.height / 2 - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0),
      }
    : { opacity: 0, scale: 0.9, x: 0, y: 0 };

  return (
    <AnimatePresence>
      {source && (
        <motion.div
          key="media-viewer"
          className="fixed inset-0 z-[1600] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => { if (chromeVisible) onClose(); else revealChrome(); }}
        >
          <motion.div
            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            style={{ opacity: backdropOpacity }}
          />

          {/* Top bar */}
          <motion.div
            className="absolute left-0 right-0 z-20 flex items-center justify-between gap-3 px-4"
            style={{ top: 'calc(var(--safe-top, 0px) + 0.75rem)', pointerEvents: chromeVisible ? 'auto' : 'none' }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: chromeVisible ? 1 : 0, y: chromeVisible ? 0 : -12 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => { e.stopPropagation(); revealChrome(); }}
          >
            <div className="flex items-center gap-2">
              {!trustLocked && url && (
                <>
                  <MediaActionButton action="download" label="Download" onRun={runDownload} />
                  <MediaActionButton action="share" label="Share" onRun={runShare} />
                  <MediaActionButton action="copy" label="Copy image" onRun={runCopy} successMessage="Image copied" />
                </>
              )}
              {trustLocked && (
                <button
                  type="button"
                  onClick={() => setShowTrustBlock(true)}
                  aria-label="Trust Lock protected"
                  className="p-2.5 rounded-full bg-white/10 text-primary backdrop-blur-md border border-primary/40"
                >
                  <span aria-hidden>🛡️</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setZoom(scale.get() > 1 ? 1 : 2.5)}
                aria-label={zoomed ? 'Reset zoom' : 'Zoom in'}
                className="p-2.5 rounded-full bg-white/10 text-white backdrop-blur-md border border-white/15"
              >
                <ZoomIn size={16} />
              </button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-3 rounded-full bg-black/70 text-white ring-1 ring-white/30 shadow-lg hover:bg-black/85 backdrop-blur-md transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </motion.div>

          {url && (
            <motion.img
              ref={imgRef}
              src={url}
              crossOrigin={url.startsWith('blob:') || url.startsWith('data:') ? undefined : 'anonymous'}
              alt={source.name || 'Media preview'}
              draggable={false}
              className="max-w-full max-h-[86vh] rounded-2xl object-contain select-none will-change-transform"
              style={{ scale, x, y, translateY: dragY }}
              initial={origin}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ ...origin, transition: { duration: 0.22, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              drag={zoomed ? true : 'y'}
              dragElastic={zoomed ? 0.05 : 0.6}
              dragMomentum={false}
              onDrag={(_, info) => { if (!zoomed) dragY.set(info.offset.y); }}
              onDragEnd={(_, info) => {
                if (zoomed) return;
                if (Math.abs(info.offset.y) > 140 || Math.abs(info.velocity.y) > 700) onClose();
                else animate(dragY, 0, { type: 'spring', stiffness: 320, damping: 30 });
              }}
              onClick={(e) => { e.stopPropagation(); revealChrome(); handleTap(); }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onContextMenu={trustLocked ? (e) => e.preventDefault() : undefined}
            />
          )}

          {!zoomed && chromeVisible && (
            <motion.p
              className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-white/45"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.35 }}
            >
              Double-tap to zoom · swipe to dismiss
            </motion.p>
          )}

          <TrustLockBlockedDialog open={showTrustBlock} onClose={() => setShowTrustBlock(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}