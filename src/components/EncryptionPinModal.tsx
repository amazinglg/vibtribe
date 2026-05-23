// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Lock, X, AlertTriangle } from 'lucide-react';
import { setupEncryptionWithPIN, unlockEncryptionWithPIN } from '@/lib/encryption';
import { toast } from 'sonner';

interface Props {
  userId: string;
  mode: 'setup' | 'unlock';
  onComplete: () => void;
  onSkip?: () => void;
}

export default function EncryptionPinModal({ userId, mode, onComplete, onSkip }: Props) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>(mode === 'setup' ? 'enter' : 'enter');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const handleSubmit = async () => {
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
        onComplete();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to set up encryption');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        await unlockEncryptionWithPIN(userId, pin);
        toast.success('Encryption unlocked 🔓');
        onComplete();
      } catch (e: any) {
        toast.error(e?.message || 'Incorrect PIN');
        setPin('');
      } finally {
        setBusy(false);
      }
    }
  };

  const activePin = mode === 'setup' && step === 'confirm' ? confirmPin : pin;
  const setActivePin = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    if (mode === 'setup' && step === 'confirm') setConfirmPin(digits);
    else setPin(digits);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-card float-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-vt-green/15 flex items-center justify-center">
            {mode === 'setup' ? <ShieldCheck size={22} className="text-vt-green" /> : <Lock size={22} className="text-vt-green" />}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">
              {mode === 'setup' ? 'Set up End-to-End Encryption' : 'Unlock your messages'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {mode === 'setup' ? 'Create a 6-digit Encryption PIN' : 'Enter your 6-digit Encryption PIN'}
            </p>
          </div>
          {mode === 'unlock' && onSkip && (
            <button onClick={onSkip} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
          )}
        </div>

        {mode === 'setup' && (
          <div className="mb-4 p-3 rounded-lg bg-vt-amber/10 border border-vt-amber/20 flex items-start gap-2">
            <AlertTriangle size={14} className="text-vt-amber mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-vt-amber/90 leading-relaxed">
              <strong>Remember this PIN.</strong> If you forget it, your encrypted message history cannot be recovered — not even by us. This is what makes it truly end-to-end encrypted.
            </p>
          </div>
        )}

        <div className="mb-2">
          <label className="text-xs text-muted-foreground mb-1.5 block">
            {mode === 'setup' && step === 'confirm' ? 'Confirm your PIN' : 'Encryption PIN'}
          </label>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={activePin}
            onChange={(e) => setActivePin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="••••••"
            className="w-full bg-input border border-border rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy || activePin.length !== 6}
          className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50 mt-4"
        >
          {busy ? 'Please wait…' : (mode === 'setup' ? (step === 'enter' ? 'Continue' : 'Create PIN & Enable Encryption') : 'Unlock')}
        </button>

        {mode === 'setup' && step === 'confirm' && (
          <button onClick={() => { setStep('enter'); setConfirmPin(''); }} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground">
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