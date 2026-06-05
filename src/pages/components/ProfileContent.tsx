// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Edit3, Shield, Bell, Lock, Smartphone, LogOut, Key, AlertTriangle, UserCheck, AtSign, Phone, Mail, ChevronDown, Ban, Monitor, RefreshCw, HelpCircle, Palette, Check, Download, Share, X, Copy, ExternalLink, MoreVertical, Trash2, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import ImageCropModal from '@/components/ImageCropModal';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { createClient } from '@/lib/supabase/client';
import HelpButton from '@/components/HelpButton';
import MyTickets from '@/components/MyTickets';
import { useTheme, APP_THEMES, ThemeId } from '@/contexts/ThemeContext';
import { triggerPwaInstall, isPwaInstallAvailable, isPwaInstalled } from '@/components/PWAInstallBanner';
import { usePermissions } from '@/hooks/usePermissions';
import EncryptionPinModal from '@/components/EncryptionPinModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Tab = 'account' | 'privacy' | 'notifications' | 'devices' | 'themes' | 'blocked' | 'support' | 'more';

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
  const { t } = useT();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [editMode, setEditMode] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifStatus, setNotifStatus] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifSecureChats, setNotifSecureChats] = useState(false);
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(true);

  // Privacy visibility settings (Profile Photo / Status)
  const [profilePhotoVisibility, setProfilePhotoVisibility] = useState<'all' | 'contacts' | 'selected'>('all');
  const [statusVisibilitySetting, setStatusVisibilitySetting] = useState<'all' | 'contacts' | 'selected'>('all');

  // App-level permissions state for the Permissions section
  const { permissions: appPerms, requestNotifications, requestMicAndCamera, requestStorage, checkAllPermissions } = usePermissions();
  useEffect(() => { checkAllPermissions(); }, [checkAllPermissions]);

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

  // Avatar upload state
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const handleAvatarFile = (file: File) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setPendingAvatarFile(file);
    setCropOpen(true);
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    if (!user) return;
    setCropOpen(false);
    setUploadingAvatar(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, blob, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      await updateProfile({ avatar_url: url });
      toast.success('Profile photo updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
      setPendingAvatarFile(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name || '');
      setBio(profile.bio || '');
      setUsername(profile.username || '');
      setDob((profile as any).dob || '');
      setEditEmail(
        profile.real_email
          || (profile.email && !profile.email.endsWith('@vibetribe.app') ? profile.email : '')
          || (user?.email && !user.email.endsWith('@vibetribe.app') ? user.email : '')
      );
      const parsed = parseCountryFromMobile(profile.mobile_number || '');
      setEditCountryCode(parsed.countryCode);
      setEditMobileNumber(parsed.number);
      if (profile.profile_photo_visibility) setProfilePhotoVisibility(profile.profile_photo_visibility);
      if (profile.status_visibility) setStatusVisibilitySetting(profile.status_visibility);
      const p: any = profile;
      if (typeof p.notif_messages === 'boolean') setNotifMessages(p.notif_messages);
      if (typeof p.notif_status === 'boolean') setNotifStatus(p.notif_status);
      if (typeof p.notif_mentions === 'boolean') setNotifMentions(p.notif_mentions);
      if (typeof p.notif_sounds === 'boolean') setNotifSounds(p.notif_sounds);
      if (typeof p.notif_secure_chats === 'boolean') setNotifSecureChats(p.notif_secure_chats);
      if (typeof p.email_marketing_opt_in === 'boolean') setEmailMarketingOptIn(p.email_marketing_opt_in);
    }
  }, [profile, user]);

  // Read ?tab= query param to support deep-linking (e.g. from unsubscribe email)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    const valid: Tab[] = ['account', 'privacy', 'notifications', 'devices', 'themes', 'blocked', 'support', 'more'];
    if (t && (valid as string[]).includes(t)) setActiveTab(t as Tab);
  }, []);

  const persistNotifPref = async (
    key: 'notif_messages' | 'notif_status' | 'notif_mentions' | 'notif_sounds' | 'notif_secure_chats' | 'email_marketing_opt_in',
    value: boolean,
  ) => {
    try {
      await updateProfile({ [key]: value } as any);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save preference');
    }
  };

  const handleToggleNotifMessages = () => {
    const next = !notifMessages; setNotifMessages(next); persistNotifPref('notif_messages', next);
  };
  const handleToggleNotifStatus = () => {
    const next = !notifStatus; setNotifStatus(next); persistNotifPref('notif_status', next);
  };
  const handleToggleNotifMentions = () => {
    const next = !notifMentions; setNotifMentions(next); persistNotifPref('notif_mentions', next);
  };
  const handleToggleNotifSounds = () => {
    const next = !notifSounds; setNotifSounds(next); persistNotifPref('notif_sounds', next);
  };
  const handleToggleNotifSecureChats = () => {
    const next = !notifSecureChats; setNotifSecureChats(next); persistNotifPref('notif_secure_chats', next);
    toast.success(next ? 'Secured chat notifications enabled' : 'Secured chat notifications disabled');
  };
  const handleToggleEmailMarketing = () => {
    const next = !emailMarketingOptIn; setEmailMarketingOptIn(next); persistNotifPref('email_marketing_opt_in', next);
    toast.success(next ? 'Subscribed to product emails' : 'Unsubscribed from product emails');
  };

  useEffect(() => {
    if (activeTab === 'privacy') loadBlockedUsers();
    if (activeTab === 'blocked') loadBlockedUsers();
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
    { key: 'account', label: t('profile.tab.account'), icon: <Edit3 size={16} /> },
    { key: 'privacy', label: t('profile.tab.privacy'), icon: <Lock size={16} /> },
    { key: 'notifications', label: t('profile.tab.notifications'), icon: <Bell size={16} /> },
    { key: 'devices', label: t('profile.tab.devices'), icon: <Smartphone size={16} /> },
    { key: 'themes', label: t('profile.tab.themes'), icon: <Palette size={16} /> },
    { key: 'blocked', label: t('profile.tab.blocked'), icon: <Ban size={16} /> },
    { key: 'support', label: 'Support', icon: <Headphones size={16} /> },
    { key: 'more', label: t('profile.tab.more'), icon: <MoreVertical size={16} /> },
  ];

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      if (normalizedUsername) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('username', normalizedUsername)
          .neq('id', user.id)
          .maybeSingle();
        if (existing) throw new Error('This username is already taken');
      }
      // DOB validation: must be 18+ if provided
      if (dob) {
        const dobD = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - dobD.getFullYear();
        const m = today.getMonth() - dobD.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobD.getDate())) age--;
        if (age < 18) throw new Error('You must be at least 18 years old');
      }
      await updateProfile({ full_name: displayName, bio, username: normalizedUsername || null, dob: dob || null } as any);
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
      const localDigits = editMobileNumber.replace(/\D/g, '').slice(-10);
      const fullMobile = localDigits ? `${editCountryCode}${localDigits}` : '';
      const updates: any = { mobile_number: fullMobile, country_code: editCountryCode };

      // Save the user's REAL email separately so it doesn't replace the
      // mobile-derived auth email (which would break mobile login). They can
      // sign in with either mobile or real_email + same password.
      if (editEmail.trim()) {
        updates.real_email = editEmail.trim().toLowerCase();
      } else {
        updates.real_email = null;
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

  // Keys that MUST survive an update wipe — auth session + E2E encryption material.
  // Anything else in localStorage/sessionStorage is treated as cache and cleared.
  const isProtectedKey = (key: string): boolean => {
    if (!key) return false;
    // Supabase auth tokens
    if (key.startsWith('sb-') || key.startsWith('supabase.')) return true;
    // VibTribe local state — includes vt_pin_*, vt_nickname_*, vt_notif_prefs_*, etc.
    // All E2E PIN material (PIN hash, last-verified timestamps, chat nicknames used
    // as part of the secure vault) lives under the `vt_` prefix.
    if (key.startsWith('vt_')) return true;
    return false;
  };

  const [updateDialog, setUpdateDialog] = useState<
    | { open: false }
    | { open: true; state: 'checking' | 'available' | 'uptodate' | 'applying' | 'error'; message?: string }
  >({ open: false });

  // Fetch the live index.html and compare a stable fingerprint (hashed asset URLs)
  // against what's currently loaded. This detects a real new deploy even if the
  // service worker hasn't picked it up yet.
  const fetchRemoteFingerprint = async (): Promise<string | null> => {
    try {
      const res = await fetch('/?__vt_update_check=' + Date.now(), {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const html = await res.text();
      // Hashed asset filenames (e.g. /assets/index-abcd1234.js) change on every deploy.
      const matches = html.match(/\/assets\/[A-Za-z0-9_\-.]+\.(?:js|css)/g) || [];
      return matches.sort().join('|');
    } catch {
      return null;
    }
  };

  const getLocalFingerprint = (): string => {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="/assets/"]'))
      .map((l) => new URL(l.href, location.href).pathname);
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="/assets/"]'))
      .map((s) => new URL(s.src, location.href).pathname);
    return [...links, ...scripts].sort().join('|');
  };

  const handleCheckForUpdate = async () => {
    // Fingerprint comparison was unreliable on the production build and could
    // falsely re-report "update available" right after a successful update.
    // Instead, treat this button as an explicit cache-reset reload that the
    // user can confirm. applyUpdate() does the real work (clear caches,
    // unregister SW, hard reload while preserving auth + E2E PIN).
    setUpdateDialog({ open: true, state: 'available' });
  };

  const applyUpdate = async () => {
    setUpdateDialog({ open: true, state: 'applying' });
    try {
      // 1. Snapshot protected keys (auth session + E2E PIN material).
      const preservedLocal: Record<string, string> = {};
      const preservedSession: Record<string, string> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && isProtectedKey(k)) {
            const v = localStorage.getItem(k);
            if (v != null) preservedLocal[k] = v;
          }
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && isProtectedKey(k)) {
            const v = sessionStorage.getItem(k);
            if (v != null) preservedSession[k] = v;
          }
        }
      } catch {}

      // 2. Wipe localStorage / sessionStorage (cache, theme prefs, transient state),
      //    then restore protected keys so the user stays signed in and keeps their PIN.
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      try {
        for (const [k, v] of Object.entries(preservedLocal)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(preservedSession)) sessionStorage.setItem(k, v);
      } catch {}

      // 3. Clear non-auth cookies on this origin. (Supabase auth uses localStorage,
      //    so cookies are safe to drop.)
      try {
        const cookies = document.cookie ? document.cookie.split(';') : [];
        for (const c of cookies) {
          const name = c.split('=')[0].trim();
          if (!name) continue;
          const host = location.hostname;
          const parts = host.split('.');
          const domains = [host, '.' + host];
          if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
          for (const d of domains) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
          }
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      } catch {}

      // 4. Clear ALL Cache Storage entries (service worker caches, runtime caches).
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch {}

      // 5. Activate any waiting service worker, then unregister all of them so the
      //    next page load gets the freshest assets directly from the network.
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            await reg.unregister().catch(() => {});
          }
        }
      } catch {}

      // 6. Hard reload with a cache-busting query so the browser fetches a fresh index.html.
      const url = new URL(window.location.href);
      url.searchParams.set('__vt_updated', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      setUpdateDialog({ open: true, state: 'error', message: 'Update failed. Please try again.' });
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

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /android/i.test(ua);
  const isInAppBrowser = /MiuiBrowser|FBAN|FBAV|Instagram|Line\/|; wv\)|Twitter|TikTok|SamsungBrowser/i.test(ua);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_my_account' as any);
      if (error) throw error;
      toast.success('Your account has been permanently deleted');
      try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
      if (typeof window !== 'undefined') window.location.href = '/sign-in';
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  const handleInstallApp = async () => {
    if (isPwaInstalled()) {
      toast.success('App is already installed on this device');
      setInstallState('installed');
      return;
    }
    if (isIOSDevice) {
      setShowInstallHelp(true);
      return;
    }
    setInstallState('installing');
    // If the prompt isn't ready yet, wait briefly for beforeinstallprompt to fire.
    let result = await triggerPwaInstall();
    if (result === 'unavailable' && !isInAppBrowser) {
      const waitId = toast.loading('Preparing install…');
      result = await new Promise<'accepted' | 'dismissed' | 'unavailable'>((resolve) => {
        let done = false;
        const onAvail = async () => {
          if (done) return;
          done = true;
          window.removeEventListener('vt:install-available', onAvail);
          const r = await triggerPwaInstall();
          resolve(r);
        };
        window.addEventListener('vt:install-available', onAvail);
        setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener('vt:install-available', onAvail);
          resolve('unavailable');
        }, 3500);
      });
      toast.dismiss(waitId);
    }
    if (result === 'accepted') {
      toast.success('VibTribe is being installed on your device');
      setInstallState('installed');
    } else if (result === 'dismissed') {
      toast.info('Install cancelled');
      setInstallState('idle');
    } else {
      setShowInstallHelp(true);
      setInstallState('unavailable');
    }
  };

  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V';
  const displayEmail = profile?.real_email
    || (profile?.email && !profile.email.endsWith('@vibetribe.app') ? profile.email : null)
    || (user?.email && !user.email.endsWith('@vibetribe.app') ? user.email : null);
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

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
          {/* Top-right logout */}
          <button
            onClick={handleSignOut}
            className="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all z-10"
            title="Sign Out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="status-ring-active p-0.5 rounded-full">
              <button
                type="button"
                onClick={() => profile?.avatar_url && setAvatarPreviewOpen(true)}
                disabled={!profile?.avatar_url}
                className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-background overflow-hidden disabled:cursor-default"
                title={profile?.avatar_url ? 'View profile photo' : 'Profile photo'}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  avatarLetter
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 w-7 h-7 gradient-cyan rounded-full flex items-center justify-center border-2 border-background text-white hover:opacity-80 transition-all disabled:opacity-50"
              title="Change profile photo"
            >
              {uploadingAvatar ? <RefreshCw size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 w-full">
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
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Date of Birth <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dob}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    onChange={e => setDob(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Must be 18+ to use VibTribe.</p>
                  <div className="mt-2 flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-[10px] leading-snug text-foreground/80">
                      🔒 Your date of birth is confidential. Only you and our support team can see it — it is never visible to other users.
                    </span>
                  </div>
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
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                  <h2 className="font-bold text-xl text-foreground">{profile?.full_name || 'Your Name'}</h2>
                </div>
                {profile?.username && (
                  <p className="text-sm text-primary mb-1">@{profile.username}</p>
                )}
                <p className="text-sm text-muted-foreground mb-3">{profile?.bio || 'No bio yet'}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all glow-primary whitespace-nowrap"
                  >
                    <Edit3 size={14} />
                    Edit Profile
                  </button>

                  {isAdmin?.() && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 px-3 py-2 bg-vt-amber/10 text-vt-amber text-sm font-semibold rounded-xl hover:bg-vt-amber/20 transition-all whitespace-nowrap"
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
        <div className="lg:w-56 flex-shrink-0 min-w-0">
          <div className="glass rounded-2xl border border-border p-1.5 grid grid-cols-8 gap-0.5 lg:flex lg:flex-col lg:gap-1 lg:p-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center lg:justify-start gap-2.5 px-1 py-2 lg:px-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-label={tab.label}
                title={tab.label}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
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
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
                  >
                    <LogOut size={14} />
                    Sign Out of All Devices
                  </button>
                  <button
                    onClick={() => { setDeleteConfirmText(''); setDeleteAccountOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                    Delete My Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-2 flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  End-to-End Encryption PIN
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Change your 6-digit encryption passcode for private chats. Your chat history stays intact.
                </p>
                <button
                  onClick={() => setChangePinOpen(true)}
                  className="px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                >
                  Change Encryption PIN
                </button>
              </div>

              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  {/* Last Seen / Read Receipts kept as toggles */}
                  {[
                    { label: 'Last Seen', desc: 'Show when you were last active' },
                    { label: 'Read Receipts', desc: 'Show when you have read messages' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <div className="w-10 h-6 rounded-full gradient-primary relative">
                        <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                  ))}

                  {/* Profile Photo Visibility */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Profile Photo</p>
                        <p className="text-xs text-muted-foreground">Who can see your profile photo</p>
                      </div>
                    </div>
                    <select
                      value={profilePhotoVisibility}
                      onChange={async (e) => {
                        const v = e.target.value as any;
                        setProfilePhotoVisibility(v);
                        try { await updateProfile({ profile_photo_visibility: v }); toast.success('Profile photo visibility updated'); } catch {}
                      }}
                      className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Users</option>
                      <option value="contacts">My Contacts</option>
                      <option value="selected">Specific Users</option>
                    </select>
                  </div>

                  {/* Status Visibility */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Status Updates</p>
                        <p className="text-xs text-muted-foreground">Who can see your 24h statuses</p>
                      </div>
                    </div>
                    <select
                      value={statusVisibilitySetting}
                      onChange={async (e) => {
                        const v = e.target.value as any;
                        setStatusVisibilitySetting(v);
                        try { await updateProfile({ status_visibility: v }); toast.success('Status visibility updated'); } catch {}
                      }}
                      className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Users</option>
                      <option value="contacts">My Contacts</option>
                      <option value="selected">Specific Users</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  Permissions
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Manage app permissions for notifications, microphone, camera and storage.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Notifications', status: appPerms.notifications, request: requestNotifications },
                    { label: 'Microphone & Camera', status: appPerms.microphone === 'granted' && appPerms.camera === 'granted' ? 'granted' : appPerms.microphone, request: requestMicAndCamera },
                    { label: 'Storage', status: appPerms.storage, request: requestStorage },
                  ].map((p) => {
                    const granted = p.status === 'granted';
                    return (
                      <div key={p.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.label}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (granted) {
                              toast.info('To revoke, change site permissions in your browser settings.');
                            } else {
                              await p.request();
                              await checkAllPermissions();
                            }
                          }}
                          className={`w-10 h-6 rounded-full relative transition-all ${granted ? 'gradient-primary' : 'bg-muted'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${granted ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legal — Terms & Privacy Policy */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-2 flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  Legal
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Review how VibTribe protects your data and the rules that apply to using the app.
                </p>
                <div className="space-y-2">
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Shield size={16} className="text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Terms &amp; Conditions</p>
                        <p className="text-xs text-muted-foreground">Rules for using VibTribe</p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground" />
                  </Link>
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Lock size={16} className="text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Privacy Policy</p>
                        <p className="text-xs text-muted-foreground">How we handle your data &amp; grievances</p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blocked' && (
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
                          className="px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  <button
                    onClick={handleToggleNotifMentions}
                    className={`w-10 h-6 rounded-full transition-all relative ${notifMentions ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifMentions ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sounds</p>
                    <p className="text-xs text-muted-foreground">Play sounds for notifications</p>
                  </div>
                  <button
                    onClick={handleToggleNotifSounds}
                    className={`w-10 h-6 rounded-full transition-all relative ${notifSounds ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSounds ? 'right-1' : 'left-1'}`} />
                  </button>
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

                {/* Divider */}
                <div className="h-px bg-border my-1" />

                {/* Email Marketing Opt-In */}
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Mail size={14} className="text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Product & Marketing Emails</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Announcements, tips and product updates. Security emails (verification, password reset) are always sent.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleEmailMarketing}
                    className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${emailMarketingOptIn ? 'gradient-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailMarketingOptIn ? 'right-1' : 'left-1'}`} />
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
              <p className="text-xs text-muted-foreground mb-5">Choose a theme for your VibTribe experience. Your selection is saved and applied across all pages.</p>
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
              {/* Change Language */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                  <Globe size={16} className="text-primary" />
                  {t('profile.language.title')}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">{t('profile.language.desc')}</p>
                <LanguageSwitcher
                  variant="card"
                  onChange={() => toast.success(t('profile.language.saved'))}
                />
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="space-y-4">
              {/* Help & Support */}
              <div className="glass rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-foreground mb-1 flex items-center gap-2">
                  <Headphones size={16} className="text-primary" />
                  Help & Support
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Having an issue? Submit a ticket and our team will get back to you.</p>
                <div className="mb-4 flex items-center gap-2 text-xs">
                  <Mail size={14} className="text-primary" />
                  <span className="text-muted-foreground">Email us:</span>
                  <a href="mailto:help.vibtribe.in@gmail.com" className="text-primary font-semibold hover:underline break-all">help.vibtribe.in@gmail.com</a>
                </div>
                <HelpButton variant="inline" />
              </div>

              {/* My Tickets */}
              <MyTickets />
            </div>
          )}
        </div>
      </div>

      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !deletingAccount && setDeleteAccountOpen(false)}>
          <div className="w-full max-w-md glass-strong rounded-3xl border border-red-500/40 p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Delete Account</h3>
                <p className="text-[11px] text-red-400">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 space-y-1.5">
              <p className="text-xs text-foreground font-semibold">⚠️ Deleting your account will permanently remove:</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>Your profile, username, and personal info</li>
                <li>All your messages, chats and secured chats</li>
                <li>All your statuses, calls and notifications</li>
                <li>Your blocked list, support tickets and devices</li>
                <li>Your sign-in account itself — there is no going back</li>
              </ul>
            </div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Type <span className="font-bold text-red-400">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deletingAccount}
              className="w-full px-3 py-2.5 bg-input border border-red-500/30 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteAccountOpen(false)}
                disabled={deletingAccount}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground hover:bg-muted/70"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingAccount ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={14} /> Permanently Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstallHelp && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowInstallHelp(false)}>
          <div className="w-full max-w-md glass-strong rounded-3xl border border-primary/30 p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center glow-primary">
                  <Download size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Install VibTribe</h3>
                  <p className="text-[11px] text-muted-foreground">Add to home screen for the full app experience</p>
                </div>
              </div>
              <button onClick={() => setShowInstallHelp(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            {isIOSDevice ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Follow these steps in <strong className="text-foreground">Safari</strong>:</p>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p className="text-xs text-foreground">Tap the <Share size={12} className="inline mx-0.5" /> <strong>Share</strong> button at the bottom of Safari.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p className="text-xs text-foreground">Scroll and tap <strong>"Add to Home Screen"</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <p className="text-xs text-foreground">Tap <strong>"Add"</strong> to finish installing.</p>
                </div>
                <p className="text-[10px] text-amber-400 mt-2">⚠️ Must be opened in Safari (not Chrome or in-app browsers).</p>
              </div>
            ) : isInAppBrowser ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-xs text-amber-300 font-semibold mb-1">⚠️ In-app browser detected</p>
                  <p className="text-[11px] text-amber-200/80">This browser doesn't support installing apps. Please open VibTribe in <strong>Chrome</strong> to install it.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p className="text-xs text-foreground">Tap the <MoreVertical size={12} className="inline" /> menu (top right) and choose <strong>"Open in Chrome"</strong> or <strong>"Open in browser"</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p className="text-xs text-foreground">Once in Chrome, return here and tap <strong>Install App</strong> again.</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.origin);
                      toast.success('Link copied — paste it in Chrome');
                    } catch {
                      toast.error('Could not copy. Long-press the URL bar to copy.');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 glass border border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-primary/10"
                >
                  <Copy size={14} /> Copy app link
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Your browser didn't surface the install prompt. Install manually:</p>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p className="text-xs text-foreground">Tap the <MoreVertical size={12} className="inline" /> menu (top-right of {isAndroid ? 'Chrome' : 'your browser'}).</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p className="text-xs text-foreground">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <p className="text-xs text-foreground">Confirm <strong>Install</strong>. VibTribe will appear on your home screen.</p>
                </div>
                <button
                  onClick={async () => {
                    const result = await triggerPwaInstall();
                    if (result === 'accepted') {
                      toast.success('Installing VibTribe…');
                      setShowInstallHelp(false);
                      setInstallState('installed');
                    } else if (result === 'unavailable') {
                      toast.info('Use the browser menu to install (steps above).');
                    } else {
                      setShowInstallHelp(false);
                    }
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl glow-primary"
                >
                  <Download size={14} /> Try install again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <ImageCropModal
        isOpen={cropOpen}
        file={pendingAvatarFile}
        onClose={() => { setCropOpen(false); setPendingAvatarFile(null); if (avatarInputRef.current) avatarInputRef.current.value=''; }}
        onCropped={handleCroppedAvatar}
        aspect={1}
        title="Crop Profile Photo"
        output={{ width: 512, height: 512, mime: 'image/jpeg', quality: 0.9 }}
      />
      {avatarPreviewOpen && profile?.avatar_url && (
        typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
            style={{ padding: 'min(var(--safe-top), 2.25rem) var(--safe-right) var(--safe-bottom) var(--safe-left)' }}
            onClick={() => setAvatarPreviewOpen(false)}
          >
            <button
              className="absolute top-3 right-3 p-2 rounded-full bg-white/15 text-white z-[210]"
              onClick={(e) => { e.stopPropagation(); setAvatarPreviewOpen(false); }}
              aria-label="Close profile photo"
            >
              <X size={20} />
            </button>
            <img
              src={profile.avatar_url}
              alt="Profile enlarged"
              className="rounded-2xl"
              style={{ maxWidth: '92vw', maxHeight: '85dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      )}
      {changePinOpen && user && (
        <EncryptionPinModal
          userId={user.id}
          mode="change"
          onComplete={() => setChangePinOpen(false)}
          onSkip={() => setChangePinOpen(false)}
        />
      )}
      <AlertDialog
        open={updateDialog.open}
        onOpenChange={(o) => { if (!o && updateDialog.open && updateDialog.state !== 'applying') setUpdateDialog({ open: false }); }}
      >
        <AlertDialogContent>
          {updateDialog.open && updateDialog.state === 'checking' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Checking for updates…</AlertDialogTitle>
                <AlertDialogDescription>Looking for a newer version of VibTribe.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
          {updateDialog.open && updateDialog.state === 'uptodate' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>You're up to date</AlertDialogTitle>
                <AlertDialogDescription>VibTribe is already running the latest version.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setUpdateDialog({ open: false })}>OK</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {updateDialog.open && updateDialog.state === 'available' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh VibTribe</AlertDialogTitle>
                <AlertDialogDescription>
                  Tap <strong>Update now</strong> to clear cached data and reload the latest
                  version. You'll stay signed in and your end-to-end encryption PIN will be
                  preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={applyUpdate}>Update now</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {updateDialog.open && updateDialog.state === 'applying' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Updating VibTribe…</AlertDialogTitle>
                <AlertDialogDescription>
                  Clearing cache and loading the new version. The app will reload in a moment.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          {updateDialog.open && updateDialog.state === 'error' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Update failed</AlertDialogTitle>
                <AlertDialogDescription>{updateDialog.message || 'Something went wrong. Please try again.'}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setUpdateDialog({ open: false })}>Close</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}