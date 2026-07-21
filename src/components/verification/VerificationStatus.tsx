import React from 'react';
import { Loader2, ShieldCheck, Check, AlertCircle } from 'lucide-react';

export function VerificationLoader({ message = 'Securely verifying your identity…' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-2 text-sm text-foreground/80" aria-live="polite">
      <span className="relative inline-flex items-center justify-center w-7 h-7">
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <ShieldCheck size={16} className="text-primary relative" />
      </span>
      <Loader2 size={14} className="animate-spin text-primary" />
      <span>{message}</span>
    </div>
  );
}

export function VerificationSuccess({ message = 'Verified' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-2 otp-success-pop" aria-live="polite">
      <span className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:color-mix(in_oklab,var(--green)_20%,transparent)] text-[color:var(--green)]">
        <span aria-hidden className="absolute inset-0 rounded-full otp-success-ripple" />
        <Check size={22} />
      </span>
      <div className="text-sm font-semibold text-foreground">✓ {message}</div>
    </div>
  );
}

export function VerificationError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-[color:color-mix(in_oklab,var(--red)_10%,transparent)] border border-[color:color-mix(in_oklab,var(--red)_35%,transparent)]" role="alert">
      <AlertCircle size={14} className="text-[color:var(--red)] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[color:var(--red)] leading-snug whitespace-pre-line">{message}</p>
    </div>
  );
}