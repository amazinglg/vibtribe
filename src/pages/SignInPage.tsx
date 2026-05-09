import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import HelpButton from '@/components/HelpButton';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const router = useNavigate();
  const { signIn, signInWithEmail } = useAuth();
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
      let profileQuery;
      if (useEmail) {
        profileQuery = await supabase
          .from('user_profiles')
          .select('id, is_suspended, login_attempts, account_status')
          .eq('email', email.trim())
          .maybeSingle();
      } else {
        const emailFromMobile = `${mobile.replace(/\D/g, '')}@vibetribe.app`;
        profileQuery = await supabase
          .from('user_profiles')
          .select('id, is_suspended, login_attempts, account_status')
          .eq('email', emailFromMobile)
          .maybeSingle();
      }

      const profileData = profileQuery?.data;

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
          await supabase
            .from('user_profiles')
            .update({ login_attempts: 0 })
            .eq('id', profileData.id);
        }

        router({ to: '/', replace: true });
      } catch (loginErr: any) {
        // Increment failed login attempts
        if (profileData?.id) {
          const currentAttempts = (profileData.login_attempts || 0) + 1;
          const updates: any = { login_attempts: currentAttempts };

          if (currentAttempts >= 5) {
            updates.is_suspended = true;
            updates.account_status = 'suspended';
            setError('Your account has been suspended after 5 failed login attempts. Please contact support.');
          } else {
            const remaining = 5 - currentAttempts;
            setError(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before account suspension.`);
          }

          await supabase.from('user_profiles').update(updates).eq('id', profileData.id);
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
    <div className="gradient-bg-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 gradient-primary rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-80 h-80 gradient-cyan rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 gradient-pink rounded-full blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative w-full max-w-md float-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibeTribe</span>
          </div>
          <p className="text-muted-foreground text-sm">Where your vibe finds its tribe ✨</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          <h1 className="font-bold text-2xl text-foreground mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign in to continue your conversations</p>

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Toggle mobile/email */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-2">
              <button
                type="button"
                onClick={() => { setUseEmail(false); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!useEmail ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                📱 Mobile Number
              </button>
              <button
                type="button"
                onClick={() => { setUseEmail(true); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${useEmail ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ✉️ Email
              </button>
            </div>

            {!useEmail ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => { setMobile(e.target.value); setError(''); }}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    autoComplete="tel"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
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
                <label className="block text-sm font-medium text-foreground">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
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
                <><Loader2 size={18} className="animate-spin" /><span>Signing in...</span></>
              ) : (
                <><span>Sign In</span><ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              New to VibeTribe?{' '}
              <Link to="/sign-up" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Create account
              </Link>
            </p>
          </div>

          {/* Help & Support */}
          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground mb-2">Need help signing in?</p>
            <HelpButton variant="inline" />
          </div>
        </div>

        {/* Floating help — always visible on the auth screens */}
        <div className="fixed bottom-4 right-4 z-40">
          <HelpButton variant="floating" />
        </div>
      </div>
    </div>
  );
}
