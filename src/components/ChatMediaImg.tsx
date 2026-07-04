import { useEffect, useState } from 'react';
import { signChatMediaUrl } from '@/lib/chat-media-url';

// Thin wrapper around <img> that resolves a private-bucket chat-media URL
// (legacy public URL or raw path) into a short-lived signed URL. Falls
// back to the original src (blob:, data:, non-chat-media URLs) unchanged.
interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}
export default function ChatMediaImg({ src, ...rest }: Props) {
  const [resolved, setResolved] = useState<string | null>(
    src?.startsWith('blob:') || src?.startsWith('data:') ? src : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!src) { setResolved(null); return; }
    if (src.startsWith('blob:') || src.startsWith('data:')) { setResolved(src); return; }
    signChatMediaUrl(src).then((u) => { if (!cancelled) setResolved(u); });
    return () => { cancelled = true; };
  }, [src]);
  if (!resolved) return null;
  return <img src={resolved} {...rest} />;
}