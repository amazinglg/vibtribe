import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import HelpButton from '@/components/HelpButton';
import { createClient } from '@/lib/supabase/client';
import LanguageDialogButton from '@/components/LanguageDialogButton';
import { useT } from '@/contexts/LanguageContext';

export default function SignInPage() {
  const router = useNavigate();
  const { signIn, signInWithEmail } = useAuth();
  const { t } = useT();
  const supabase = createClient();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [email, setEmail] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) { setError('Please enter your password'); return; }
    if (!useEmail && !mobile) { setError('Please enter your mobile number'); return; }
    if (useEmail && !email) { setError('Please enter your email'); return; }

    setLoading(true);
    try {
      // Check if account is suspended before attempting login
      let identifier: string;
      if (useEmail) {
        identifier = email.trim().toLowerCase();
      } else {
        const local10 = mobile.replace(/\D/g, '').slice(-10);
        if (local10.length !== 10) { setError('Please enter a valid 10-digit mobile number'); setLoading(false); return; }
        identifier = `${local10}@vibetribe.app`;
      }

      const { data: lookup } = await supabase.rpc('pre_login_lookup', { _identifier: identifier });
      const profileData: any = Array.isArray(lookup) ? lookup[0] : lookup;

      if (profileData?.is_suspended || profileData?.account_status === 'suspended') {
        setError('Your account has been suspended due to too many failed login attempts. Please contact support or wait for admin to unsuspend your account.');
        setLoading(false);
        return;
      }

      try {
        if (useEmail) {
          await signInWithEmail(email, password);
        } else {
          await signIn(mobile, password);
        }

        // Reset login attempts on successful login
        if (profileData?.id) {
          await supabase.rpc('record_login_success', { _user_id: profileData.id });
        }

        console.log('[VT-LOGIN] sign-in succeeded, navigating to /');
        router({ to: '/', replace: true });
      } catch (loginErr: any) {
        console.error('[VT-LOGIN] sign-in failed', loginErr);
        // Increment failed login attempts
        if (profileData?.id) {
          const { data: newCount } = await supabase.rpc('record_login_failure', { _user_id: profileData.id });
          const currentAttempts = typeof newCount === 'number' ? newCount : (profileData.login_attempts || 0) + 1;
          if (currentAttempts >= 5) {
            setError('Your account has been suspended after 5 failed login attempts. Please contact support.');
          } else {
            const remaining = 5 - currentAttempts;
            setError(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before account suspension.`);
          }
        } else {
          setError(loginErr.message || 'Invalid credentials. Please try again.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="gradient-bg-page min-h-screen w-full flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto px-4"
      style={{
        // Safe-area: status bar clearance only — extra spacing comes from the
        // inner container's py-4. Adding +1rem on top of safe-top and then
        // centering the inner card with my-auto produced excessive whitespace
        // above the logo on tall phones.
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      {/* Animated background orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 gradient-primary rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-80 h-80 gradient-cyan rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 gradient-pink rounded-full blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative w-full max-w-md float-up pt-3 pb-6">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibTribe</span>
          </div>
          <p className="text-muted-foreground text-sm">{t('auth.tagline')}</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          <h1 className="font-bold text-2xl text-foreground mb-1">{t('auth.welcomeBack')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('auth.signInSubtitle')}</p>

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Toggle mobile/email */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-2">
              <button
                type="button"
                onClick={() => { setUseEmail(false); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!useEmail ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t('auth.mobileTab')}
              </button>
              <button
                type="button"
                onClick={() => { setUseEmail(true); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${useEmail ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t('auth.emailTab')}
              </button>
            </div>

            {!useEmail ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.mobile')}</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={mobile}
                  onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                  placeholder="98765 43210"
                  maxLength={10}
                    className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    autoComplete="tel"
                  />
                </div>
              <p className="text-[11px] text-muted-foreground mt-1">Enter 10-digit number only — no country code</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="email"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">{t('auth.password')}</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-12 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="current-password"
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

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>{t('auth.signingIn')}</span></>
              ) : (
                <><span>{t('common.signIn')}</span><ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.newToVibtribe')}{' '}
              <Link to="/sign-up" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                {t('common.createAccount')}
              </Link>
            </p>
          </div>

          {/* Help & Support */}
          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground mb-2">{t('auth.needHelpSignIn')}</p>
            <div className="flex justify-center">
              <HelpButton variant="inline" />
            </div>
          </div>

          {/* Change Language */}
          <div className="mt-4 text-center">
            <LanguageDialogButton />
          </div>
        </div>
      </div>
    </div>
  );
}
