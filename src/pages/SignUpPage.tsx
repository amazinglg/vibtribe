import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, User, Calendar, Mail, ArrowLeft, ShieldCheck, Check } from 'lucide-react';
import {
  OTPInput,
  VerificationCard,
  ResendButton,
  VerificationLoader,
  VerificationSuccess,
  VerificationError,
  type OTPStatus,
} from '@/components/verification';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import Wordmark from '@/components/ui/Wordmark';
import { supabase } from '@/integrations/supabase/client';
import LanguageDialogButton from '@/components/LanguageDialogButton';
import { useT } from '@/contexts/LanguageContext';
import { recordMarketingConsent } from '@/lib/marketing.functions';
import CountryCodeSelect from '@/components/CountryCodeSelect';
import { useDetectCountry } from '@/hooks/useDetectCountry';

export default function SignUpPage() {
  const router = useNavigate();
  const { t } = useT();
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const { country, setCountry } = useDetectCountry();
  const countryCode = country.dial;
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OTPStatus>('idle');

  // Max DOB = today minus 13 years (used as `max` attribute on the date input)
  const maxDobStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().split('T')[0];
  })();

  const isAtLeastMinAge = (isoDate: string) => {
    if (!isoDate) return false;
    const dobD = new Date(isoDate);
    if (isNaN(dobD.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dobD.getFullYear();
    const m = today.getMonth() - dobD.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobD.getDate())) age--;
    return age >= 13;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (!dob) { setError('Please enter your date of birth'); return; }
    if (!isAtLeastMinAge(dob)) { setError('You must be at least 13 years old to sign up on VibTribe'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return; }
    if (!mobile.trim()) { setError('Please enter your mobile number'); return; }
    if (mobile.replace(/\D/g, '').length < 7) { setError('Please enter a valid mobile number'); return; }
    if (!password) { setError('Please enter a password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!acceptedTerms) { setError('Please accept the Terms & Conditions to continue'); return; }
    if (!acceptedPrivacy) { setError('Please accept the Privacy Policy to continue'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/public/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_signup',
          email: email.trim().toLowerCase(),
          name: fullName.trim(),
          countryCode,
          mobileNumber: mobile.replace(/\D/g, '').slice(-10),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to send verification code');
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      const res = await fetch('/api/public/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_signup', email: email.trim().toLowerCase(), name: fullName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to resend code');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code from your email'); setOtpStatus('error'); return; }
    const local = mobile.replace(/\D/g, '').slice(-10);
    const fullMobile = `${countryCode}${local}`;
    setLoading(true);
    setOtpStatus('verifying');
    try {
      const res = await fetch('/api/public/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_account',
          email: email.trim().toLowerCase(),
          code: otp,
          password,
          fullName: fullName.trim(),
          countryCode,
          mobileNumber: fullMobile,
          dob,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to create account');

      // Sign in with the synthetic auth email returned by the server
      const authEmail = json.authEmail || `${local}@vibetribe.app`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: authEmail, password });
      if (signInErr) throw signInErr;
      try { await supabase.rpc('accept_terms' as any); } catch {}
      // Record marketing consent decision (explicit opt-in only — DPDP/GDPR).
      try {
        await recordMarketingConsent({ data: { optIn: marketingOptIn, source: 'signup' } });
      } catch {}
      setOtpStatus('success');
      // Route any minor (<18) into the guardian consent flow first.
      const ageOf = (iso: string) => {
        const d = new Date(iso); const t = new Date();
        let a = t.getFullYear() - d.getFullYear();
        const m = t.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
        return a;
      };
      const isMinor = ageOf(dob) < 18;
      setTimeout(() => router({ to: isMinor ? '/guardian-setup' : '/complete-profile', replace: true }), 700);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setOtpStatus('error');
      setTimeout(() => setOtpStatus('idle'), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-aurora-page min-h-screen w-full flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto px-4"
      style={{
        // Cap injected Android safe-top (physical px) to avoid huge gap on
        // high-DPR devices.
        paddingTop: 'min(var(--safe-top), 2.25rem)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      <div className="aurora-ambient" aria-hidden="true" />

      <div className="relative w-full max-w-md float-up pt-4 pb-8">
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <AppLogo size={40} />
            <Wordmark className="text-2xl" />
          </div>
          <p className="auth-aurora-chip inline-flex rounded-full px-3 py-1 text-muted-foreground text-xs">{t('auth.joinTribe')}</p>
        </div>

        <div className="auth-aurora-card rounded-[2rem] p-8 shadow-card">
          {step === 'verify' ? (
            <VerificationCard
              title="Verify your email"
              subtitle="We've sent a verification code to"
              email={email}
              onBack={() => { setStep('details'); setOtp(''); setError(''); setOtpStatus('idle'); }}
              backLabel="Back to details"
            >
              <form onSubmit={handleVerifyAndCreate} className="space-y-5">
                <OTPInput
                  value={otp}
                  onChange={v => { setOtp(v); setError(''); if (otpStatus === 'error') setOtpStatus('idle'); }}
                  status={otpStatus}
                  disabled={loading}
                />
                {error && <VerificationError message={error} />}
                {otpStatus === 'verifying' && <VerificationLoader message="Securely verifying your identity…" />}
                {otpStatus === 'success' && <VerificationSuccess message="Verified — creating your account" />}
                <button type="submit" disabled={loading || otp.length !== 6} className="otp-primary-btn">
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Verifying…</span></>
                  ) : (
                    <><span>Verify & Create Account</span><ArrowRight size={18} /></>
                  )}
                </button>
                <div className="flex justify-center pt-1">
                  <ResendButton onResend={handleResend} disabled={resending} />
                </div>
              </form>
            </VerificationCard>
          ) : (
          <>
          <h1 className="font-bold text-2xl text-foreground mb-1">{t('auth.createAccountTitle')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('auth.createAccountSubtitle')}</p>

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.fullName')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setError(''); }}
                  placeholder="Your full name"
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('auth.dob')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={dob}
                  max={maxDobStr}
                  onChange={e => { setDob(e.target.value); setError(''); }}
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{t('auth.dobHint')}</p>
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-[11px] leading-snug text-foreground/80">
                  🔒 Your date of birth stays confidential. Only you and our support team can see it — it is never shown to other users.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.mobile')}</label>
              <div className="flex gap-2">
                <CountryCodeSelect value={country} onChange={c => { setCountry(c); setError(''); }} />
                {/* Number Input */}
                <div className="relative flex-1">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => { setMobile(e.target.value.replace(/\D/g, '')); setError(''); }}
                    placeholder="98765 43210"
                    className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Used as your unique identifier — no OTP required</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="email"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">We'll send a 6-digit code to verify your email.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder={t('auth.passwordHint')}
                  className="w-full pl-9 pr-12 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Re-enter your password"
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

            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <button
                type="button"
                onClick={() => { setAcceptedTerms(v => !v); setError(''); }}
                aria-pressed={acceptedTerms}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${acceptedTerms ? 'bg-primary border-primary' : 'bg-input border-border hover:border-primary'}`}
              >
                {acceptedTerms && <Check size={13} className="text-white" />}
              </button>
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have read and accept VibTribe's{' '}
                <Link to="/terms" className="text-primary hover:underline" target="_blank">Terms &amp; Conditions</Link>.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => { setAcceptedPrivacy(v => !v); setError(''); }}
                aria-pressed={acceptedPrivacy}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${acceptedPrivacy ? 'bg-primary border-primary' : 'bg-input border-border hover:border-primary'}`}
              >
                {acceptedPrivacy && <Check size={13} className="text-white" />}
              </button>
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have read and accept VibTribe's{' '}
                <Link to="/privacy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setMarketingOptIn(v => !v)}
                aria-pressed={marketingOptIn}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${marketingOptIn ? 'bg-primary border-primary' : 'bg-input border-border hover:border-primary'}`}
              >
                {marketingOptIn && <Check size={13} className="text-white" />}
              </button>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Send me product updates, tips, and announcements from VibTribe. You can unsubscribe anytime. (Optional)
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
              className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>Sending code…</span></>
              ) : (
                <><span>Send verification code</span><ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/sign-in" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                {t('common.signIn')}
              </Link>
            </p>
          </div>

          {/* Change Language */}
          <div className="mt-4 text-center">
            <LanguageDialogButton />
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
