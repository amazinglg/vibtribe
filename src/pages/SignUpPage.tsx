import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate as _useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, User } from 'lucide-react';
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


export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (!mobile.trim()) { setError('Please enter your mobile number'); return; }
    if (mobile.replace(/\D/g, '').length < 10) { setError('Please enter a valid mobile number (min 10 digits)'); return; }
    if (!password) { setError('Please enter a password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await signUp(mobile, password, { fullName });
      router.replace('/complete-profile');
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 gradient-cyan rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-80 h-80 gradient-pink rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 left-1/4 w-64 h-64 gradient-primary rounded-full blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative w-full max-w-md float-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibeTribe</span>
          </div>
          <p className="text-muted-foreground text-sm">Join the tribe today ✨</p>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          <h1 className="font-bold text-2xl text-foreground mb-1">Create account</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign up with your mobile number — no verification needed</p>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
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
              <p className="text-xs text-muted-foreground mt-1">Used as your unique identifier — no OTP required</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Min. 6 characters"
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>Creating account...</span></>
              ) : (
                <><span>Create Account</span><ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
