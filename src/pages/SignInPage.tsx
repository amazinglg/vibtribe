import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate as _useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

function useRouter() {
  const navigate = _useNavigate();
  return {
    push: (to: string) => navigate({ to: to as any }),
    replace: (to: string) => navigate({ to: to as any, replace: true }),
    back: () => { if (typeof window !== 'undefined') window.history.back(); },
    refresh: () => {},
  };
}


export default function SignInPage() {
  const router = useRouter();
  const { signIn, signInWithEmail } = useAuth();
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
      if (useEmail) {
        await signInWithEmail(email, password);
      } else {
        await signIn(mobile, password);
      }
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
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

          {/* Demo credentials */}
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Demo Credentials</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>📱 Admin: <span className="text-foreground font-mono">labhanshgarg.3@gmail.com</span> / <span className="text-foreground font-mono">Admin@123</span></p>
              <p>👤 Test User: <span className="text-foreground font-mono">+911234567890</span> / <span className="text-foreground font-mono">Test@123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
