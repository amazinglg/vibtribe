// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Lock, X, AlertTriangle, Clock, KeyRound } from 'lucide-react';
import {
  setupEncryptionWithPIN,
  unlockEncryptionWithPIN,
  changeEncryptionPIN,
  clearLocalKey,
} from '@/lib/encryption';
import { toast } from 'sonner';

interface Props {
  userId: string;
  mode: 'setup' | 'unlock' | 'change';
  onComplete: () => void;
  onSkip?: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function fmtRelative(ts: number) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export default function EncryptionPinModal({ userId, mode, onComplete, onSkip }: Props) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [busy, setBusy] = useState(false);
  // setup:    enter -> confirm
  // change:   current -> enter -> confirm
  const initialStep: 'current' | 'enter' | 'confirm' =
    mode === 'change' ? 'current' : 'enter';
  const [step, setStep] = useState<'current' | 'enter' | 'confirm'>(initialStep);
  const inputRef = useRef<HTMLInputElement>(null);

  // Throttling state (only meaningful in 'unlock' mode)
  const lockoutKey = `vt_pin_lockout_until_${userId}`;
  const failsKey = `vt_pin_fails_${userId}`;
  const lastVerifiedKey = `vt_pin_last_verified_${userId}`;
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(lockoutKey) || '0', 10); } catch { return 0; }
  });
  const [now, setNow] = useState(Date.now());
  const lastUnlock = (() => {
    try { return parseInt(localStorage.getItem(lastVerifiedKey) || '0', 10); } catch { return 0; }
  })();

  // Clean up any legacy biometric credentials from previous versions.
  useEffect(() => {
    try {
      localStorage.removeItem(`vt_bio_cred_${userId}`);
      localStorage.removeItem(`vt_bio_pin_${userId}`);
    } catch {}
  }, [userId]);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  // Lockout countdown ticker
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const isLocked = lockedUntil > now;
  const lockSecsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const handleSubmit = async () => {
    if (isLocked) return;

    // ---- CHANGE MODE ----
    if (mode === 'change') {
      if (step === 'current') {
        if (!/^\d{6}$/.test(oldPin)) { toast.error('Enter your current 6-digit PIN'); return; }
        setStep('enter');
        setPin('');
        return;
      }
      if (step === 'enter') {
        if (!/^\d{6}$/.test(pin)) { toast.error('PIN must be exactly 6 digits'); return; }
        if (pin === oldPin) { toast.error('New PIN must be different'); return; }
        setStep('confirm');
        setConfirmPin('');
        return;
      }
      // confirm
      if (pin !== confirmPin) { toast.error('PINs do not match'); setConfirmPin(''); return; }
      setBusy(true);
      try {
        await changeEncryptionPIN(userId, oldPin, pin);
        toast.success('PIN changed successfully 🔒');
        onComplete();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to change PIN');
      } finally { setBusy(false); }
      return;
    }

    // ---- SETUP / UNLOCK ----
    if (!/^\d{6}$/.test(pin)) {
      toast.error('PIN must be exactly 6 digits');
      return;
    }
    if (mode === 'setup') {
      if (step === 'enter') {
        setStep('confirm');
        setConfirmPin('');
        return;
      }
      if (pin !== confirmPin) {
        toast.error('PINs do not match. Try again.');
        setConfirmPin('');
        return;
      }
      setBusy(true);
      try {
        await setupEncryptionWithPIN(userId, pin);
        toast.success('Encryption set up successfully 🔒');
        localStorage.setItem(lastVerifiedKey, String(Date.now()));
        try { sessionStorage.setItem(`vt_pin_session_${userId}`, '1'); } catch {}
        onComplete();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to set up encryption');
      } finally {
        setBusy(false);
      }
    } else {
      // UNLOCK
      setBusy(true);
      try {
        await unlockEncryptionWithPIN(userId, pin);
        // Reset throttle on success
        localStorage.removeItem(failsKey);
        localStorage.removeItem(lockoutKey);
        localStorage.setItem(lastVerifiedKey, String(Date.now()));
        toast.success('Encryption unlocked 🔓');
        onComplete();
      } catch (e: any) {
        // Throttle on failure
        const fails = (parseInt(localStorage.getItem(failsKey) || '0', 10) || 0) + 1;
        localStorage.setItem(failsKey, String(fails));
        const remaining = MAX_ATTEMPTS - fails;
        if (remaining <= 0) {
          const until = Date.now() + LOCKOUT_MS;
          localStorage.setItem(lockoutKey, String(until));
          localStorage.removeItem(failsKey);
          setLockedUntil(until);
          await clearLocalKey();
          toast.error('Too many wrong PINs. Locked for 5 minutes.');
        } else {
          toast.error(`Incorrect PIN — ${remaining} attempt${remaining > 1 ? 's' : ''} left`);
        }
        setPin('');
      } finally {
        setBusy(false);
      }
    }
  };

  const activePin =
    mode === 'change' && step === 'current' ? oldPin
    : step === 'confirm' ? confirmPin
    : pin;

  const setActivePin = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    if (mode === 'change' && step === 'current') setOldPin(digits);
    else if (step === 'confirm') setConfirmPin(digits);
    else setPin(digits);
  };

  const heading =
    mode === 'setup' ? 'Set up End-to-End Encryption'
    : mode === 'change' ? 'Change Encryption PIN'
    : 'Unlock your messages';

  const subheading =
    mode === 'setup' ? 'Create a 6-digit Encryption PIN'
    : mode === 'change'
      ? (step === 'current' ? 'Enter your current PIN' : step === 'enter' ? 'Choose a new 6-digit PIN' : 'Confirm your new PIN')
      : 'Enter your 6-digit Encryption PIN';

  const inputLabel =
    mode === 'change' && step === 'current' ? 'Current PIN'
    : step === 'confirm' ? (mode === 'change' ? 'Confirm new PIN' : 'Confirm your PIN')
    : (mode === 'change' ? 'New PIN' : 'Encryption PIN');

  const buttonLabel = busy ? 'Please wait…'
    : mode === 'setup' ? (step === 'enter' ? 'Continue' : 'Create PIN & Enable Encryption')
    : mode === 'change' ? (step === 'confirm' ? 'Change PIN' : 'Continue')
    : 'Unlock';

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-card float-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-vt-green/15 flex items-center justify-center">
            {mode === 'setup' ? <ShieldCheck size={22} className="text-vt-green" />
              : mode === 'change' ? <KeyRound size={22} className="text-vt-green" />
              : <Lock size={22} className="text-vt-green" />}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">{heading}</h3>
            <p className="text-[11px] text-muted-foreground">{subheading}</p>
          </div>
          {(mode === 'unlock' || mode === 'change') && onSkip && (
            <button onClick={onSkip} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
          )}
        </div>

        {mode === 'unlock' && lastUnlock > 0 && (
          <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock size={12} />
            <span>Last unlocked {fmtRelative(lastUnlock)}</span>
          </div>
        )}

        {mode === 'setup' && (
          <div className="mb-4 p-3 rounded-lg bg-vt-amber/10 border border-vt-amber/20 flex items-start gap-2">
            <AlertTriangle size={14} className="text-vt-amber mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-vt-amber/90 leading-relaxed">
              <strong>Important:</strong> This PIN can be set <strong>only once</strong>. If you lose it, your entire encrypted chat history is lost forever — not even we can recover it. This is what makes it truly end-to-end encrypted.
            </p>
          </div>
        )}

        {isLocked && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
            <AlertTriangle size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-xs text-red-400 font-semibold">Too many failed attempts</p>
            <p className="text-[11px] text-red-400/80">Try again in {Math.floor(lockSecsLeft / 60)}:{String(lockSecsLeft % 60).padStart(2, '0')}</p>
          </div>
        )}

        <div className="mb-2">
          <label className="text-xs text-muted-foreground mb-1.5 block">{inputLabel}</label>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={activePin}
            onChange={(e) => setActivePin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={isLocked}
            placeholder="••••••"
            className="w-full bg-input border border-border rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy || isLocked || activePin.length !== 6}
          className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50 mt-4"
        >
          {buttonLabel}
        </button>

        {((mode === 'setup' && step === 'confirm') ||
          (mode === 'change' && step !== 'current')) && (
          <button
            onClick={() => {
              if (mode === 'change' && step === 'confirm') { setStep('enter'); setConfirmPin(''); }
              else if (mode === 'change' && step === 'enter') { setStep('current'); setPin(''); }
              else { setStep('enter'); setConfirmPin(''); }
            }}
            className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-4">
          🔒 Your PIN never leaves your device. We only store the encrypted key blob.
        </p>
      </div>
    </div>
  );
}