// @ts-nocheck
import React, { useState } from 'react';
import { Mail, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

/**
 * Full-screen blocking gate shown to ANY logged-in user (existing or new)
 * whose profile has no verified email (`real_email` is empty/null).
 * The user cannot use chats or any other feature until they add an email
 * and complete the 6-digit OTP verification.
 */
export default function EmailVerificationGate() {
  const { user, profile, fetchProfile } = useAuth();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only render when we have a profile and it has no real_email
  if (!user || !profile) return null;
  if (profile.real_email) return null;

  const authedFetch = async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const res = await fetch('/api/public/auth-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return json;
  };

  const handleSend = async () => {
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError('Please enter a valid email address');
      return;
    }
    setSending(true);
    try {
      await authedFetch({ action: 'send_verify_existing', email: clean });
      toast.success('Code sent — check your inbox');
      setStep('code');
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setVerifying(true);
    try {
      await authedFetch({
        action: 'verify_existing',
        email: email.trim().toLowerCase(),
        code,
      });
      toast.success('Email verified — welcome!');
      // Refresh profile so the gate unmounts
      if (user?.id) await fetchProfile(user.id);
    } catch (e: any) {
      setError(e.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md glass rounded-3xl border border-border p-6 sm:p-7 shadow-2xl">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-vt-amber/10 border border-vt-amber/30 mb-5">
          <AlertTriangle size={18} className="text-vt-amber flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-vt-amber mb-0.5">Email verification required</p>
            <p className="text-muted-foreground">
              For account security, every VibTribe account must have a verified email.
              You can't access chats or other features until verification is complete.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 gradient-primary rounded-2xl flex items-center justify-center glow-primary">
            {step === 'email' ? <Mail size={20} className="text-white" /> : <ShieldCheck size={20} className="text-white" />}
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">
              {step === 'email' ? 'Add your email' : 'Enter verification code'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === 'email'
                ? 'We\'ll send a 6-digit code to confirm it\'s yours.'
                : `Sent to ${email}`}
            </p>
          </div>
        </div>

        {step === 'email' ? (
          <>
            <label className="text-xs text-muted-foreground mb-1 block">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              className="w-full px-3 py-3 bg-input border border-border rounded-xl text-sm text-foreground focus:border-primary outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full mt-4 px-4 py-3 gradient-primary rounded-xl text-white font-semibold text-sm glow-primary disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-muted-foreground mb-1 block">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              className="w-full px-3 py-3 bg-input border border-border rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-foreground focus:border-primary outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={verifying || code.length !== 6}
              className="w-full mt-4 px-4 py-3 gradient-primary rounded-xl text-white font-semibold text-sm glow-primary disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : 'Verify & continue'}
            </button>
            <button
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}