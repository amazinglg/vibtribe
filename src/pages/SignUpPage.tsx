import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, User, ChevronDown, Check, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { supabase } from '@/integrations/supabase/client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/contexts/LanguageContext';

const COUNTRY_CODES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'China', code: '+86', flag: '🇨🇳' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'UAE', code: '+971', flag: '🇦🇪' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
];

export default function SignUpPage() {
  const router = useNavigate();
  const { signUp } = useAuth();
  const { t } = useT();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  // Max DOB = today minus 18 years (used as `max` attribute on the date input)
  const maxDobStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  const isAtLeast18 = (isoDate: string) => {
    if (!isoDate) return false;
    const dobD = new Date(isoDate);
    if (isNaN(dobD.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dobD.getFullYear();
    const m = today.getMonth() - dobD.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobD.getDate())) age--;
    return age >= 18;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (!username.trim()) { setError('Please choose a username'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username can only contain letters, numbers, and underscores'); return; }
    if (!dob) { setError('Please enter your date of birth'); return; }
    if (!isAtLeast18(dob)) { setError('You must be at least 18 years old to sign up on VibTribe'); return; }
    if (!mobile.trim()) { setError('Please enter your mobile number'); return; }
    if (mobile.replace(/\D/g, '').length < 7) { setError('Please enter a valid mobile number'); return; }
    if (!password) { setError('Please enter a password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!acceptedTerms) { setError('Please accept the Terms & Conditions and Privacy Policy to continue'); return; }

    // Store full mobile (with code) in profile metadata, but the auth email
    // will be derived from the local 10-digit number only (handled in AuthContext).
    const local = mobile.replace(/\D/g, '').slice(-10);
    const fullMobile = `${countryCode}${local}`;
    setLoading(true);
    try {
      await signUp(fullMobile, password, { fullName, countryCode, username: username.toLowerCase(), dob });
      // Record terms acceptance immediately so the in-app gate doesn't re-prompt.
      try { await supabase.rpc('accept_terms' as any); } catch (e) { console.warn('[VT-SIGNUP] accept_terms failed', e); }
      router({ to: '/complete-profile', replace: true });
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

      <div className="absolute top-3 right-3 z-30">
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="relative w-full max-w-md float-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <AppLogo size={48} />
            <span className="font-bold text-3xl text-gradient-primary tracking-tight">VibTribe</span>
          </div>
          <p className="text-muted-foreground text-sm">{t('auth.joinTribe')}</p>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-8 shadow-card">
          <h1 className="font-bold text-2xl text-foreground mb-1">{t('auth.createAccountTitle')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('auth.createAccountSubtitle')}</p>

          <form onSubmit={handleSignUp} className="space-y-4">
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
                {t('auth.username')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()); setError(''); }}
                  placeholder="your_username"
                  className="w-full pl-9 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  autoComplete="username"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{t('auth.usernameHint')}</p>
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
                {/* Country Code Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="flex items-center gap-1.5 px-3 py-3 bg-input border border-border rounded-xl text-sm text-foreground hover:border-primary transition-all whitespace-nowrap h-full"
                  >
                    <span>{selectedCountry.flag}</span>
                    <span className="font-medium">{selectedCountry.code}</span>
                    <ChevronDown size={13} className="text-muted-foreground" />
                  </button>
                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                      {COUNTRY_CODES.map(c => (
                        <button
                          key={`${c.name}-${c.code}`}
                          type="button"
                          onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); setError(''); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left ${countryCode === c.code && selectedCountry.name === c.name ? 'text-primary font-medium' : 'text-foreground'}`}
                        >
                          <span>{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="text-muted-foreground text-xs">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                {t('auth.agreeTerms')}{' '}
                <Link to="/terms" className="text-primary hover:underline" target="_blank">{t('auth.terms')}</Link>
                {' '}{t('auth.and')}{' '}
                <Link to="/privacy" className="text-primary hover:underline" target="_blank">{t('auth.privacy')}</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-primary mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>{t('auth.creatingAccount')}</span></>
              ) : (
                <><span>{t('common.createAccount')}</span><ArrowRight size={18} /></>
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
        </div>
      </div>
    </div>
  );
}
