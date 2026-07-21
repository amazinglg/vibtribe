import React, { useState } from 'react';
import { Loader2, Check, RotateCw } from 'lucide-react';
import { nativeHaptic } from '@/lib/native-bridge';

export interface ResendButtonProps {
  onResend: () => Promise<void> | void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Morphing resend button: idle → spinner → success tick.
 */
export default function ResendButton({ onResend, disabled, label = 'Resend verification code', className = '' }: ResendButtonProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handle = async () => {
    if (state !== 'idle' || disabled) return;
    setState('sending');
    try { nativeHaptic('light'); } catch {}
    try {
      await onResend();
      setState('sent');
      try { nativeHaptic('medium'); } catch {}
      setTimeout(() => setState('idle'), 2400);
    } catch {
      setState('idle');
    }
  };

  const isSending = state === 'sending';
  const isSent = state === 'sent';

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || isSending}
      aria-live="polite"
      className={[
        'relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full',
        'text-xs font-semibold transition-all duration-300 select-none',
        'border border-primary/30 bg-primary/10 text-primary',
        'hover:bg-primary/15 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(124,58,237,0.35)]',
        'active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed',
        isSent && 'bg-[color-mix(in_oklab,var(--green)_20%,transparent)] text-[color:var(--green)] border-[color:color-mix(in_oklab,var(--green)_45%,transparent)]',
        'otp-resend-pulse',
        className,
      ].filter(Boolean).join(' ')}
    >
      {isSending ? (
        <><Loader2 size={13} className="animate-spin" /><span>Sending…</span></>
      ) : isSent ? (
        <><Check size={13} /><span>New code sent</span></>
      ) : (
        <><RotateCw size={13} /><span>{label}</span></>
      )}
    </button>
  );
}