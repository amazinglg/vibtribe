import { useEffect, useState } from "react";
import { getSignedStatusMediaUrl } from "@/lib/statusMedia";

type Kind = "image" | "video";

interface Props {
  value?: string | null;
  kind: Kind;
  className?: string;
  alt?: string;
  muted?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
  playsInline?: boolean;
}

export function StatusMedia({ value, kind, className, alt = "", muted, autoPlay, controls, playsInline }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    getSignedStatusMediaUrl(value).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [value]);

  if (!url) return <div className={className} aria-hidden />;
  if (kind === "video") {
    return (
      <video
        src={url}
        className={className}
        muted={muted}
        autoPlay={autoPlay}
        controls={controls}
        playsInline={playsInline}
      />
    );
  }
  return <img src={url} alt={alt} className={className} />;
}