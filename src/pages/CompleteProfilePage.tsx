import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AtSign, FileText, Camera, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

export default function CompleteProfilePage() {
  const router = useNavigate();
  const { user, updateProfile, profile } = useAuth();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skipping, setSkipping] = useState(false);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please choose a username'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username can only contain letters, numbers, and underscores'); return; }

    setLoading(true);
    try {
      // Hard timeout so the page can never freeze on a stalled refetch
      const update = updateProfile({
        username: username.toLowerCase(),
        bio,
        profile_completed: true,
      });
      await Promise.race([
        update,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]).catch(() => {});
      router({ to: '/', replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save profile. Please try again.');
      setLoading(false);
      return;
    } finally {
      // loading stays true until navigation completes
    }
  };

  // Username is now mandatory — Skip option removed (kept handler for backwards compat but unused)

  return (
    <div className="gradient-bg-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 gradient-tri rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-80 h-80 gradient-primary rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1.5s' }} />

      <div className="relative w-full max-w-md float-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibTribe</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-vt-green">
            <CheckCircle2 size={18} />
            <p className="text-sm font-medium">Account created successfully!</p>
          </div>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Step 2 of 3</p>
          <h1 className="font-bold text-2xl text-foreground mb-1">Choose your username</h1>
          <p className="text-muted-foreground text-sm mb-6">Pick a unique handle for your VibTribe profile. Next you'll set your 6-digit end-to-end encryption passcode.</p>

          {/* Avatar placeholder */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-border">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V'}
              </div>
              <button className="absolute bottom-0 right-0 w-7 h-7 gradient-cyan rounded-full flex items-center justify-center border-2 border-background text-white hover:opacity-80 transition-all">
                <Camera size={12} />
              </button>
            </div>
          </div>

          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Username <span className="text-red-400">*</span></label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="your_username"
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="username"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Letters, numbers, underscores only. Min 3 characters.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bio <span className="text-muted-foreground text-xs">(optional)</span></label>
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell your tribe about yourself..."
                  rows={3}
                  maxLength={150}
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm resize-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/150</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>Saving...</span></>
              ) : (
                <><span>Complete Profile</span><ArrowRight size={18} /></>
              )}
            </button>

            <p className="text-center text-[11px] text-muted-foreground pt-1">
              Next: set your 6-digit end-to-end encryption passcode
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
