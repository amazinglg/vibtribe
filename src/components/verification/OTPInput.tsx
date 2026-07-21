import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { nativeHaptic } from '@/lib/native-bridge';

export type OTPStatus = 'idle' | 'verifying' | 'error' | 'success';

export interface OTPInputProps {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  status?: OTPStatus;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (v: string) => void;
  ariaLabel?: string;
}

/**
 * Premium 6-cell OTP input.
 * - Glass cells with purple focus glow
 * - Per-cell scale/fade on digit entry
 * - Error shake, success glow ripple
 * - Native haptics on digit/success/error (Capacitor)
 * - Full paste + backspace + arrow key support
 * - Respects prefers-reduced-motion
 */
export default function OTPInput({
  value,
  onChange,
  length = 6,
  status = 'idle',
  autoFocus = true,
  disabled = false,
  onComplete,
  ariaLabel = 'Verification code',
}: OTPInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const [popIdx, setPopIdx] = useState<number>(-1);
  const groupId = useId();

  const digits = React.useMemo(() => {
    const arr = value.split('').slice(0, length);
    while (arr.length < length) arr.push('');
    return arr;
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => inputsRef.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
  }, [value, length, onComplete]);

  useEffect(() => {
    if (status === 'error') {
      try { nativeHaptic('medium'); } catch {}
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(60);
    } else if (status === 'success') {
      try { nativeHaptic('heavy'); } catch {}
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([30, 40, 30]);
    }
  }, [status]);

  const focusIndex = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(length - 1, i));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  }, [length]);

  const setAt = useCallback((i: number, ch: string) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join('').replace(/[^\d]/g, ''));
  }, [digits, onChange]);

  const handleInput = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    // Multi-char (paste through single cell / mobile autofill)
    if (clean.length > 1) {
      const merged = (digits.join('').slice(0, i) + clean).slice(0, length);
      onChange(merged);
      const nextIdx = Math.min(merged.length, length - 1);
      setPopIdx(nextIdx);
      setTimeout(() => setPopIdx(-1), 200);
      focusIndex(nextIdx);
      try { nativeHaptic('light'); } catch {}
      return;
    }
    setAt(i, clean);
    setPopIdx(i);
    setTimeout(() => setPopIdx(-1), 180);
    try { nativeHaptic('light'); } catch {}
    if (i < length - 1) focusIndex(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        setAt(i, '');
      } else if (i > 0) {
        setAt(i - 1, '');
        focusIndex(i - 1);
      }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusIndex(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focusIndex(i + 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); focusIndex(length - 1); }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    const merged = (digits.join('').slice(0, i) + text).slice(0, length);
    onChange(merged);
    const nextIdx = Math.min(merged.length, length - 1);
    focusIndex(nextIdx);
  };

  const isError = status === 'error';
  const isSuccess = status === 'success';
  const isVerifying = status === 'verifying';

  return (
    <div
      className={`otp-group flex justify-between items-center gap-2 sm:gap-2.5 ${isError ? 'otp-shake' : ''}`}
      role="group"
      aria-label={ariaLabel}
      aria-invalid={isError || undefined}
    >
      {digits.map((d, i) => {
        const filled = !!d;
        const focused = focusIdx === i;
        return (
          <div
            key={`${groupId}-${i}`}
            className={[
              'otp-cell',
              filled && 'otp-cell--filled',
              focused && 'otp-cell--focused',
              isError && 'otp-cell--error',
              isSuccess && 'otp-cell--success',
              isVerifying && 'otp-cell--verifying',
              popIdx === i && 'otp-cell--pop',
            ].filter(Boolean).join(' ')}
          >
            <input
              ref={el => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              pattern="[0-9]*"
              maxLength={length}
              value={d}
              disabled={disabled || isVerifying || isSuccess}
              aria-label={`Digit ${i + 1} of ${length}`}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={e => handlePaste(i, e)}
              onFocus={() => setFocusIdx(i)}
              onBlur={() => setFocusIdx(v => (v === i ? -1 : v))}
              onClick={e => (e.currentTarget as HTMLInputElement).select()}
              className="otp-input"
            />
          </div>
        );
      })}
    </div>
  );
}