import { useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useConnectionState } from '@/lib/offline/connection';

/**
 * Subtle connection state pill. Replaces generic spinners with a real
 * connection story: offline → reconnecting → syncing → up to date.
 * The "up to date" state auto-hides so nothing lingers on screen.
 */
export default function ConnectionStatusPill({ className = '' }: { className?: string }) {
  const state = useConnectionState();
  const [visible, setVisible] = useState(false);
  const seen = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (state === 'offline' || state === 'reconnecting' || state === 'syncing') {
      seen.current = true;
      setVisible(true);
      return;
    }
    // synced — only worth announcing if we were away
    if (seen.current) {
      setVisible(true);
      hideTimer.current = setTimeout(() => { setVisible(false); seen.current = false; }, 1800);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(hideTimer.current);
  }, [state]);

  const copy: Record<string, { label: string; icon: JSX.Element; tone: string }> = {
    offline: {
      label: "You're offline",
      icon: <CloudOff size={12} />,
      tone: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
    },
    reconnecting: {
      label: 'Reconnecting…',
      icon: <RefreshCw size={12} className="animate-spin" />,
      tone: 'bg-white/10 text-white/80 border-white/15',
    },
    syncing: {
      label: 'Syncing…',
      icon: <Loader2 size={12} className="animate-spin" />,
      tone: 'bg-white/10 text-white/80 border-white/15',
    },
    synced: {
      label: 'Everything is up to date',
      icon: <Check size={12} />,
      tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
    },
  };
  const c = copy[state];

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none flex justify-center transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 max-h-10' : 'opacity-0 -translate-y-1 max-h-0'
      } ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md ${c.tone}`}
      >
        {c.icon}
        {c.label}
      </span>
    </div>
  );
}