import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface VerificationCardProps {
  title?: string;
  subtitle?: React.ReactNode;
  email?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Premium glass verification card with entry animation, animated email reveal
 * and slot for OTPInput + actions.
 */
export default function VerificationCard({
  title = 'Verify your identity',
  subtitle = "We've sent a verification code to",
  email,
  icon,
  children,
  footer,
  onBack,
  backLabel = 'Back',
}: VerificationCardProps) {
  return (
    <div className="otp-card-enter relative">
      {/* Soft ambient halos */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 w-56 h-56 rounded-full bg-primary/20 blur-3xl opacity-70" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 w-56 h-56 rounded-full bg-[color:var(--pink)]/15 blur-3xl opacity-70" />

      <div className="relative glass-strong rounded-3xl border border-white/10 p-6 sm:p-8 shadow-[0_30px_80px_-30px_rgba(124,58,237,0.55)]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {backLabel}
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <div className="otp-shield relative w-14 h-14 rounded-2xl gradient-primary glow-primary flex items-center justify-center mb-4">
            {icon ?? <ShieldCheck size={26} className="text-white" />}
            <span aria-hidden className="otp-shield-ring absolute inset-0 rounded-2xl" />
          </div>

          <h1 className="font-semibold tracking-tight text-[22px] sm:text-[24px] text-foreground mb-1">
            {title}
          </h1>
          {(subtitle || email) && (
            <p className="text-sm text-muted-foreground max-w-xs">
              {subtitle}
              {email && (
                <>
                  {' '}
                  <span className="otp-email inline-block text-foreground font-medium break-all align-baseline">
                    {email.split('').map((c, i) => (
                      <span
                        key={i}
                        className="otp-email-char inline-block"
                        style={{ animationDelay: `${140 + i * 22}ms` }}
                      >
                        {c === ' ' ? '\u00A0' : c}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="mt-6">{children}</div>

        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </div>
  );
}