import React from 'react';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=app.vibtribe.app';

function PlayIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" role="img">
      <defs>
        <linearGradient id="vt-gp-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00C3FF" />
          <stop offset="100%" stopColor="#1FE6A8" />
        </linearGradient>
        <linearGradient id="vt-gp-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFD500" />
          <stop offset="100%" stopColor="#FF9E00" />
        </linearGradient>
        <linearGradient id="vt-gp-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF4B5C" />
          <stop offset="100%" stopColor="#E5093E" />
        </linearGradient>
        <linearGradient id="vt-gp-d" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#11D2A6" />
          <stop offset="100%" stopColor="#0BE07B" />
        </linearGradient>
      </defs>
      <path fill="url(#vt-gp-a)" d="M63 34c-8 5-13 15-13 28v388c0 13 5 23 13 28l2 1 218-218v-10L65 33z" />
      <path fill="url(#vt-gp-b)" d="M356 334l-73-73v-10l73-73 2 1 86 49c25 14 25 37 0 51l-86 49z" />
      <path fill="url(#vt-gp-c)" d="M358 333l-75-75L63 478c8 9 22 10 38 1z" />
      <path fill="url(#vt-gp-d)" d="M358 179L101 33C85 24 71 25 63 34l220 220z" />
    </svg>
  );
}

type Props = {
  className?: string;
  primaryText?: string;
  secondaryText?: string;
  fullWidth?: boolean;
};

/**
 * Premium "Get it on Google Play" CTA — aurora glassmorphism, soft glow,
 * hover lift, click ripple and haptic feedback on supported mobile browsers.
 */
export default function GooglePlayButton({
  className = '',
  primaryText = 'Get VibTribe on Google Play',
  secondaryText = 'Fast • Secure • Automatic Updates',
  fullWidth = true,
}: Props) {
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 650);
    try {
      navigator.vibrate?.(12);
    } catch {}
  };

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Get VibTribe on Google Play"
      className={`vt-play-btn group relative isolate overflow-hidden inline-flex items-center gap-3 sm:gap-4 rounded-[1.4rem] px-5 sm:px-7 py-3.5 sm:py-4 text-left ${
        fullWidth ? 'w-full justify-center sm:justify-start' : ''
      } ${className}`}
    >
      <span className="vt-play-btn__sheen" aria-hidden="true" />
      <span className="relative flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
        <PlayIcon />
      </span>
      <span className="relative min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
          Get it on
        </span>
        <span className="block text-sm sm:text-base font-extrabold leading-tight text-white">
          {primaryText}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-white/70">{secondaryText}</span>
      </span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="vt-play-btn__ripple"
          style={{ left: r.x, top: r.y }}
          aria-hidden="true"
        />
      ))}
    </a>
  );
}