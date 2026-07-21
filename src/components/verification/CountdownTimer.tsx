import React, { useEffect, useState } from 'react';

export interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  size?: number;
  label?: string;
  runKey?: string | number;
}

/**
 * Animated circular countdown indicator.
 * Uses SVG stroke-dashoffset for a smooth per-second sweep.
 */
export default function CountdownTimer({
  seconds,
  onComplete,
  size = 56,
  label = 'Resend available in',
  runKey,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) return;
    const start = Date.now();
    const total = seconds * 1000;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, total - elapsed);
      const s = Math.ceil(left / 1000);
      setRemaining(prev => (prev !== s ? s : prev));
      if (left <= 0) {
        onComplete?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, runKey]);

  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const dashOffset = c * (1 - progress);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={3}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="url(#vt-ring-grad)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1000ms linear' }}
          />
          <defs>
            <linearGradient id="vt-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-semibold text-foreground tabular-nums">
          {mm}:{ss}
        </div>
      </div>
      <div className="text-xs text-muted-foreground leading-tight">
        <div>{label}</div>
        <div className="text-foreground/70 text-[11px]">Please wait a moment</div>
      </div>
    </div>
  );
}