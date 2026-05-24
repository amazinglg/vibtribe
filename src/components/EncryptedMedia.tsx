// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { decryptBytes } from '@/lib/encryption';
import { Download, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  url: string;
  mime: string;
  name?: string;
  kind: 'image' | 'file' | 'audio';
  theirPublicKey: string;
}

// Tiny in-memory cache so a re-render doesn't re-fetch & re-decrypt.
const blobCache = new Map<string, string>();

export default function EncryptedMedia({ url, mime, name, kind, theirPublicKey }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(blobCache.get(url) || null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(!blobCache.has(url));

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
        const plain = await decryptBytes(cipher, theirPublicKey);
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
  }, [url, mime, theirPublicKey]);

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
    return <img src={blobUrl} alt={name || 'Shared image'} className="max-w-[200px] rounded-xl" />;
  }
  if (kind === 'audio') {
    return <audio controls src={blobUrl} className="max-w-[220px]" />;
  }
  return (
    <a
      href={blobUrl}
      download={name || 'file'}
      className="flex items-center gap-2 text-sm underline"
    >
      <FileText size={16} />
      <span className="truncate max-w-[160px]">{name || 'file'}</span>
      <Download size={14} />
    </a>
  );
}