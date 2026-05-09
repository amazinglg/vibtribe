import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address'); return; }

    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 gradient-primary rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-80 h-80 gradient-cyan rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative w-full max-w-md float-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibeTribe</span>
          </div>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          {sent ? (
            <div className="text-center py-4 float-up">
              <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 glow-primary">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h1 className="font-bold text-2xl text-foreground mb-2">Check your email</h1>
              <p className="text-muted-foreground text-sm mb-6">
                We sent a password reset link to <span className="text-foreground font-medium">{email}</span>. Click the link to reset your password.
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
              <h1 className="font-bold text-2xl text-foreground mb-1">Reset password</h1>
              <p className="text-muted-foreground text-sm mb-6">Enter your email and we will send you a reset link</p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
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
                  <p className="text-xs text-muted-foreground mt-1">For mobile accounts, use your mobile number as email: <span className="font-mono">91XXXXXXXXXX@vibetribe.app</span></p>
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
                    <><span>Send Reset Link</span><ArrowRight size={18} /></>
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
