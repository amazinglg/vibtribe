import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'identifier' | 'verify' | 'done'>('identifier');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('Please enter your email or mobile number'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/public/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reset', identifier: identifier.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to send code');
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code from your email'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/public/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', identifier: identifier.trim(), code: otp, newPassword }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Failed to reset password');
      setStep('done');
      setTimeout(() => navigate({ to: '/sign-in', replace: true }), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="gradient-bg-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
      }}
    >
      <div className="absolute top-0 left-0 w-96 h-96 gradient-primary rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-80 h-80 gradient-cyan rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative w-full max-w-md float-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibTribe</span>
          </div>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          {step === 'done' ? (
            <div className="text-center py-4 float-up">
              <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h1 className="font-bold text-2xl text-foreground mb-2">Password reset</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Your password has been updated. Redirecting you to sign in…
              </p>
              <Link
                to="/sign-in"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </Link>
            </div>
          ) : step === 'verify' ? (
            <>
              <button
                type="button"
                onClick={() => { setStep('identifier'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setError(''); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center justify-center w-14 h-14 rounded-full gradient-primary glow-primary mx-auto mb-3">
                <ShieldCheck size={26} className="text-white" />
              </div>
              <h1 className="font-bold text-2xl text-foreground mb-1 text-center">Enter your code</h1>
              <p className="text-muted-foreground text-sm mb-6 text-center">
                If an account exists for <span className="text-foreground font-medium">{identifier}</span>, we sent a 6-digit code to its email.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••••"
                    className="w-full px-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setError(''); }}
                      placeholder="At least 6 characters"
                      className="w-full pl-9 pr-12 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                      placeholder="Re-enter new password"
                      className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || !newPassword}
                  className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Resetting…</span></>
                  ) : (
                    <><span>Reset password</span><ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link to="/sign-in" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
              <h1 className="font-bold text-2xl text-foreground mb-1">Reset password</h1>
              <p className="text-muted-foreground text-sm mb-6">Enter your email or mobile number and we'll send a 6-digit code to your registered email.</p>

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email or Mobile Number</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={e => { setIdentifier(e.target.value); setError(''); }}
                      placeholder="you@example.com or 10-digit mobile"
                      className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                      autoComplete="username"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">The code is delivered to the email on file for your account.</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Sending...</span></>
                  ) : (
                    <><span>Send 6-digit code</span><ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
