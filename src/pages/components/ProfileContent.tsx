// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Camera, Edit3, Shield, Bell, Lock, Smartphone, LogOut, Key, AlertTriangle, UserCheck, AtSign, Phone, Mail, ChevronDown, Ban, Monitor, RefreshCw, HelpCircle, Palette, Check, Download, Share } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { createClient } from '@/lib/supabase/client';
import HelpButton from '@/components/HelpButton';
import MyTickets from '@/components/MyTickets';
import { useTheme, APP_THEMES, ThemeId } from '@/contexts/ThemeContext';
import { triggerPwaInstall, isPwaInstallAvailable, isPwaInstalled } from '@/components/PWAInstallBanner';

type Tab = 'account' | 'privacy' | 'notifications' | 'devices' | 'themes' | 'more';

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

function parseCountryFromMobile(mobile: string): { countryCode: string; number: string } {
  if (!mobile) return { countryCode: '+91', number: '' };
  for (const c of COUNTRY_CODES) {
    if (mobile.startsWith(c.code)) {
      return { countryCode: c.code, number: mobile.slice(c.code.length).trim() };
    }
  }
  if (mobile.startsWith('+')) {
    return { countryCode: '+91', number: mobile };
  }
  return { countryCode: '+91', number: mobile };
}

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  full_name?: string;
  username?: string;
}

interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent?: string;
  ip?: string;
  isCurrent?: boolean;
}

export default function ProfileContent() {
  const router = useNavigate();
  const { user, profile, updateProfile, updatePassword, signOut, isAdmin } = useAuth();
  const { currentTheme, setTheme } = useTheme();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifStatus, setNotifStatus] = useState(true);
  const [notifSecureChats, setNotifSecureChats] = useState(false);

  // Contact edit states
  const [editContact, setEditContact] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+91');
  const [editMobileNumber, setEditMobileNumber] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Block/unblock states
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Sessions/devices states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loggingOutSession, setLoggingOutSession] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name || '');
      setBio(profile.bio || '');
      setUsername(profile.username || '');
      setEditEmail(profile.email && !profile.email.endsWith('@vibetribe.app') ? profile.email : (user?.email && !user.email.endsWith('@vibetribe.app') ? user.email : ''));
      const parsed = parseCountryFromMobile(profile.mobile_number || '');
      setEditCountryCode(parsed.countryCode);
      setEditMobileNumber(parsed.number);
    }
  }, [profile, user]);

  // Load notification preferences from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`vt_notif_prefs_${user.id}`);
      if (stored) {
        try {
          const prefs = JSON.parse(stored);
          if (typeof prefs.messages === 'boolean') setNotifMessages(prefs.messages);
          if (typeof prefs.status === 'boolean') setNotifStatus(prefs.status);
          if (typeof prefs.secureChats === 'boolean') setNotifSecureChats(prefs.secureChats);
        } catch {}
      }
    }
  }, [user]);

  const saveNotifPrefs = (messages: boolean, status: boolean, secureChats: boolean) => {
    if (user) {
      localStorage.setItem(`vt_notif_prefs_${user.id}`, JSON.stringify({ messages, status, secureChats }));
    }
  };

  const handleToggleNotifMessages = () => {
    const next = !notifMessages;
    setNotifMessages(next);
    saveNotifPrefs(next, notifStatus, notifSecureChats);
  };

  const handleToggleNotifStatus = () => {
    const next = !notifStatus;
    setNotifStatus(next);
    saveNotifPrefs(notifMessages, next, notifSecureChats);
  };

  const handleToggleNotifSecureChats = () => {
    const next = !notifSecureChats;
    setNotifSecureChats(next);
    saveNotifPrefs(notifMessages, notifStatus, next);
    if (next) {
      toast.success('Secured chat notifications enabled');
    } else {
      toast.success('Secured chat notifications disabled');
    }
  };

  useEffect(() => {
    if (activeTab === 'privacy') loadBlockedUsers();
    if (activeTab === 'devices') loadSessions();
  }, [activeTab]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    try {
      const { data } = await supabase
        .from('blocked_users')
        .select('id, blocked_user_id, user_profiles!blocked_users_blocked_user_id_fkey(full_name, username)')
        .eq('blocker_id', user.id);
      const mapped = (data || []).map((b: any) => ({
        id: b.id,
        blocked_user_id: b.blocked_user_id,
        full_name: b.user_profiles?.full_name,
        username: b.user_profiles?.username,
      }));
      setBlockedUsers(mapped);
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockUser = async (blockId: string, name: string) => {
    try {
      await supabase.from('blocked_users').delete().eq('id', blockId);
      setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
      toast.success(`${name} unblocked`);
    } catch {
      toast.error('Failed to unblock user');
    }
  };

  const loadSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      // Get all active sessions from Supabase auth
      const { data, error } = await supabase.auth.admin ? 
        { data: null, error: null } : 
        { data: null, error: null };
      
      // Fallback: show current session info from user object
      const currentSession: Session = {
        id: 'current',
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        isCurrent: true,
      };
      setSessions([currentSession]);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    if (sessionId === 'current') {
      // Logout current session
      try {
        await signOut();
        router({ to: '/sign-in', replace: true });
      } catch {}
      return;
    }
    setLoggingOutSession(sessionId);
    try {
      // For other sessions, use global sign out
      await supabase.auth.signOut({ scope: 'global' });
      toast.success('Signed out from all devices');
      router({ to: '/sign-in', replace: true });
    } catch {
      toast.error('Failed to sign out from device');
    }
    setLoggingOutSession(null);
  };

  const getDeviceName = (userAgent: string) => {
    if (/iphone/i.test(userAgent)) return 'iPhone';
    if (/ipad/i.test(userAgent)) return 'iPad';
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/macintosh/i.test(userAgent)) return 'Mac';
    if (/windows/i.test(userAgent)) return 'Windows PC';
    if (/linux/i.test(userAgent)) return 'Linux';
    return 'Web Browser';
  };

  const getBrowserName = (userAgent: string) => {
    if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/edg/i.test(userAgent)) return 'Edge';
    return 'Browser';
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'account', label: 'Account', icon: <Edit3 size={16} /> },
    { key: 'privacy', label: 'Privacy', icon: <Lock size={16} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { key: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
    { key: 'themes', label: 'Themes', icon: <Palette size={16} /> },
    { key: 'more', label: 'More', icon: <HelpCircle size={16} /> },
  ];

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: displayName, bio, username: username.toLowerCase() });
      setEditMode(false);
      toast.success('Profile updated successfully ✓');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveContact = async () => {
    setSavingContact(true);
    try {
      const fullMobile = editMobileNumber.trim() ? `${editCountryCode}${editMobileNumber.trim()}` : '';
      const updates: any = { mobile_number: fullMobile };

      // Update email in auth if provided and different from current — no verification email
      if (editEmail.trim() && editEmail !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editEmail.trim(),
          options: { emailRedirectTo: undefined },
        } as any);
        if (emailError) throw emailError;
        updates.email = editEmail.trim();
      } else if (editEmail.trim()) {
        updates.email = editEmail.trim();
      }

      await updateProfile(updates);
      setEditContact(false);
      toast.success('Contact information updated ✓');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update contact info');
    } finally {
      setSavingContact(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmNewPassword) { toast.error('Passwords do not match'); return; }
    setChangingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password changed successfully ✓');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router({ to: '/sign-in', replace: true });
    } catch {}
  };

  const handleUpdateApp = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Force service worker to update
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
      // Clear localStorage cache keys (not auth)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('sb-') && !key.startsWith('supabase')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      // Clear sessionStorage
      sessionStorage.clear();
      toast.success('App updated! Reloading to apply latest version...');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('Failed to update app. Please refresh manually.');
    }
  };

  const [installState, setInstallState] = useState<'idle' | 'installed' | 'unavailable' | 'installing'>('idle');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPwaInstalled()) { setInstallState('installed'); return; }
    if (!isPwaInstallAvailable()) setInstallState('unavailable');
    const onAvail = () => setInstallState('idle');
    const onInstalled = () => setInstallState('installed');
    window.addEventListener('vt:install-available', onAvail);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('vt:install-available', onAvail);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOSDevice = typeof navigator !== 'undefined' && (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );

  const handleInstallApp = async () => {
    if (isPwaInstalled()) {
      toast.success('App is already installed on this device');
      setInstallState('installed');
      return;
    }
    if (isIOSDevice) {
      toast.info('On iPhone/iPad: tap the Share button in Safari, then "Add to Home Screen".', { duration: 7000 });
      return;
    }
    setInstallState('installing');
    const result = await triggerPwaInstall();
    if (result === 'accepted') {
      toast.success('VibeTribe is being installed on your device');
      setInstallState('installed');
    } else if (result === 'dismissed') {
      toast.info('Install cancelled');
      setInstallState('idle');
    } else {
      toast.info('Install prompt is not available yet — try again in a moment, or use your browser menu → Install VibeTribe.');
      setInstallState('unavailable');
    }
  };

  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V';
  const displayEmail = profile?.email && !profile.email.endsWith('@vibetribe.app') ? profile.email : (user?.email && !user.email.endsWith('@vibetribe.app') ? user.email : null);
  const displayMobile = profile?.mobile_number || null;
  const selectedCountry = COUNTRY_CODES.find(c => c.code === editCountryCode) || COUNTRY_CODES[0];

  return (
    <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
      {/* Profile Header */}
      <div className="glass rounded-3xl border border-border p-6 mb-6 relative overflow-hidden card-3d">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-48 h-48 gradient-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 gradient-cyan rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="status-ring-active p-0.5 rounded-full">
              <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-background">
                {avatarLetter}
              </div>
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 gradient-cyan rounded-full flex items-center justify-center border-2 border-background text-white hover:opacity-80 transition-all">
              <Camera size={12} />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your_username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={2}
                    maxLength={150}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setDisplayName(profile?.full_name || ''); setBio(profile?.bio || ''); }}
                    className="px-4 py-2 glass border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-bold text-xl text-foreground">{profile?.full_name || 'Your Name'}</h2>
                  {isAdmin?.() && (
                    <span className="text-xs bg-vt-amber/20 text-vt-amber px-2 py-0.5 rounded-full font-medium">Master Admin</span>
                  )}
                </div>
                {profile?.username && (
                  <p className="text-sm text-primary mb-1">@{profile.username}</p>
                )}
                <p className="text-sm text-muted-foreground mb-3">{profile?.bio || 'No bio yet'}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all glow-primary"
                  >
                    <Edit3 size={14} />
                    Edit Profile
                  </button>

                  {isAdmin?.() && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-4 py-2 bg-vt-amber/10 text-vt-amber text-sm font-semibold rounded-xl hover:bg-vt-amber/20 transition-all"
                    >
                      <Shield size={14} />
                      Admin Panel
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab Nav */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass rounded-2xl border border-border p-2 flex flex-row lg:flex-col gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeTab === tab.key ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all mt-auto"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'account' && (
            <div className="space-y-4">
              {/* Account Info */}
              <div className="glass rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base text-foreground">Account Information</h3>
                  {!editContact && (
                    <button
                      onClick={() => setEditContact(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
                    >
                      <Edit3 size={12} />
                      Edit Contact
                    </button>
                  )}
                </div>

                {editContact ? (
                  <div className="space-y-4">
                    {/* Email Edit */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Mobile Edit with Country Code */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mobile Number</label>
                      <div className="flex gap-2">
                        {/* Country Code Selector */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground hover:border-primary transition-all whitespace-nowrap"
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
                                  onClick={() => { setEditCountryCode(c.code); setShowCountryDropdown(false); }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left ${editCountryCode === c.code && selectedCountry.name === c.name ? 'text-primary font-medium' : 'text-foreground'}`}
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
                        <input
                          type="tel"
                          value={editMobileNumber}
                          onChange={e => setEditMobileNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="98765 43210"
                          className="flex-1 px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveContact}
                        disabled={savingContact}
                        className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {savingContact ? 'Saving...' : 'Save Contact Info'}
                      </button>
                      <button
                        onClick={() => {
                          setEditContact(false);
                          setShowCountryDropdown(false);
                          const parsed = parseCountryFromMobile(profile?.mobile_number || '');
                          setEditCountryCode(parsed.countryCode);
                          setEditMobileNumber(parsed.number);
                          setEditEmail(displayEmail || '');
                        }}
                        className="px-4 py-2 glass border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Email Row */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Email Address</p>
                        <p className="text-sm text-foreground font-medium truncate">{displayEmail || <span className="text-muted-foreground italic">Not added</span>}</p>
                      </div>
                    </div>
                    {/* Mobile Row */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Mobile Number</p>
                        <p className="text-sm text-foreground font-medium">{displayMobile || <span className="text-muted-foreground italic">Not added</span>}</p>
                      </div>
                    </div>
                    {/* Username Row */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <AtSign size={16} className="text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Username</p>
                        <p className="text-sm text-foreground font-medium">{profile?.username ? `@${profile.username}` : 'Not set'}</p>
                      </div>
                    </div>
                    {/* Member Since Row */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <UserCheck size={16} className="text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Member Since</p>
                        <p className="text-sm text-foreground font-medium">
                          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Change Password */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
                  <Key size={16} className="text-primary" />
                  Change Password
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmNewPassword}
                    className="px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glass rounded-2xl border border-red-500/20 p-5">
                <h3 className="font-semibold text-base text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Danger Zone
                </h3>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
                >
                  <LogOut size={14} />
                  Sign Out of All Devices
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Last Seen', desc: 'Show when you were last active', enabled: true },
                    { label: 'Read Receipts', desc: 'Show when you have read messages', enabled: true },
                    { label: 'Profile Photo', desc: 'Who can see your profile photo', enabled: true },
                    { label: 'Status Updates', desc: 'Who can see your 24h statuses', enabled: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all cursor-pointer ${item.enabled ? 'gradient-primary' : 'bg-muted'} relative`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.enabled ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blocked Users */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
                  <Ban size={16} className="text-red-400" />
                  Blocked Users
                </h3>
                {loadingBlocked ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-4">
                    <Ban size={20} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No blocked users</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(b => (
                      <div key={b.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(b.full_name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{b.full_name || 'Unknown'}</p>
                          {b.username && <p className="text-xs text-muted-foreground">@{b.username}</p>}
                        </div>
                        <button
                          onClick={() => handleUnblockUser(b.id, b.full_name || 'User')}
                          className="px-3 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">New Messages</p>
                    <p className="text-xs text-muted-foreground">Get notified for new chat messages</p>
                  </div>
                  <button
                    onClick={handleToggleNotifMessages}
                    className={`w-10 h-6 rounded-full transition-all relative ${notifMessages ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifMessages ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">Status Updates</p>
                    <p className="text-xs text-muted-foreground">Get notified when contacts post statuses</p>
                  </div>
                  <button
                    onClick={handleToggleNotifStatus}
                    className={`w-10 h-6 rounded-full transition-all relative ${notifStatus ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifStatus ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mentions</p>
                    <p className="text-xs text-muted-foreground">Get notified when someone mentions you</p>
                  </div>
                  <div className="w-10 h-6 rounded-full transition-all gradient-primary relative">
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sounds</p>
                    <p className="text-xs text-muted-foreground">Play sounds for notifications</p>
                  </div>
                  <div className="w-10 h-6 rounded-full transition-all gradient-primary relative">
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border my-1" />

                {/* Secured Chat Notifications */}
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground">Secured Chat Notifications</p>
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Lock size={9} />
                        Secure
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notifSecureChats
                        ? 'You will receive notifications for new messages in secured chats'
                        : 'Notifications for secured chats are silenced (default)'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleNotifSecureChats}
                    className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${notifSecureChats ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSecureChats ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-1">Active Sessions</h3>
              <p className="text-xs text-muted-foreground mb-4">Manage devices where you are logged in</p>
              
              {loadingSessions ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className={`flex items-center gap-3 p-3 rounded-xl border ${session.isCurrent ? 'bg-primary/10 border-primary/20' : 'bg-muted/30 border-border'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${session.isCurrent ? 'gradient-primary' : 'bg-muted'}`}>
                        {session.user_agent && /iphone|ipad|android/i.test(session.user_agent) ? (
                          <Smartphone size={16} className={session.isCurrent ? 'text-white' : 'text-muted-foreground'} />
                        ) : (
                          <Monitor size={16} className={session.isCurrent ? 'text-white' : 'text-muted-foreground'} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {session.user_agent ? getDeviceName(session.user_agent) : 'Unknown Device'}
                          </p>
                          {session.isCurrent && (
                            <span className="text-[10px] bg-vt-green/20 text-vt-green px-1.5 py-0.5 rounded-full font-medium">Current</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.user_agent ? getBrowserName(session.user_agent) : 'Web'} — {session.isCurrent ? 'Active now' : `Last active ${new Date(session.updated_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLogoutSession(session.id)}
                        disabled={loggingOutSession === session.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        <LogOut size={12} />
                        {loggingOutSession === session.id ? '...' : 'Logout'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all w-full justify-center"
              >
                <LogOut size={14} />
                Sign Out All Devices
              </button>
            </div>
          )}

          {activeTab === 'themes' && (
            <div className="glass rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                <Palette size={16} className="text-primary" />
                App Themes
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Choose a theme for your VibeTribe experience. Your selection is saved and applied across all pages.</p>
              <div className="grid grid-cols-1 gap-3">
                {APP_THEMES.map((theme) => {
                  const isActive = currentTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setTheme(theme.id as ThemeId)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        isActive
                          ? 'border-primary bg-primary/10' :'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      {/* Color swatches */}
                      <div className="flex gap-1 flex-shrink-0">
                        {theme.preview.map((color, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full border border-white/10 flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{theme.name}</p>
                          {theme.id === 'theme-1' && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">Default</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
                      </div>
                      {/* Active indicator */}
                      {isActive && (
                        <div className="w-6 h-6 gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'more' && (
            <div className="space-y-4">
              {/* Update App */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                  <RefreshCw size={16} className="text-primary" />
                  App Maintenance
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Clear cached data and update to the latest version without logging out.</p>
                <button
                  onClick={handleUpdateApp}
                  className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all glow-primary"
                >
                  <RefreshCw size={14} />
                  Update the App
                </button>
              </div>

              {/* Help & Support */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                  <HelpCircle size={16} className="text-primary" />
                  Help & Support
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Having an issue? Contact us and we will get back to you.</p>
                <HelpButton variant="inline" />
              </div>

              {/* My Tickets */}
              <MyTickets />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}