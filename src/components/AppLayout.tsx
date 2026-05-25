// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import AppLogo from '@/components/ui/AppLogo';
import { MessageCircle, CircleDot, User, Bell, Shield, Lock, ChevronLeft, ChevronRight, Wifi, LogOut, Search } from 'lucide-react';
import SecureVaultModal from './SecureVaultModal';
import { useAuth } from '@/contexts/AuthContext';
import PWAInstallBanner from './PWAInstallBanner';
import GlobalSearchBar from './GlobalSearchBar';
import Icon from '@/components/ui/AppIcon';
import HelpButton from '@/components/HelpButton';
import PermissionPrompt from '@/components/PermissionPrompt';
import { usePermissions } from '@/hooks/usePermissions';
import { useChatStore } from '@/store/chatStore';
import CallProvider from '@/components/CallProvider';
import { createClient } from '@/lib/supabase/client';
import EncryptionPinModal from '@/components/EncryptionPinModal';
import { hasLocalPrivateKey, hasServerKey } from '@/lib/encryption';
import { useT } from '@/contexts/LanguageContext';



export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useLocation().pathname;
  const router = useNavigate();
  const { user, profile, signOut, isAdmin } = useAuth();
  const { isSecureSession, closeSecureChat } = useChatStore();
  const { t } = useT();
  const NAV_ITEMS = [
    { href: '/', label: t('nav.chats'), icon: MessageCircle, badge: 0 },
    { href: '/status-screen', label: t('nav.status'), icon: CircleDot, badge: 0 },
    { href: '/profile-screen', label: t('nav.profile'), icon: User, badge: 0 },
  ];

  // Derive a short page title for the mobile topbar based on the current route.
  const pageTitle = pathname === '/'
    ? t('nav.messages')
    : pathname.startsWith('/status')
      ? t('nav.status')
      : pathname.startsWith('/profile')
        ? t('nav.profile')
        : pathname.startsWith('/admin')
          ? t('nav.admin')
          : '';

  // Auto-relock secured chat when tab is hidden / app backgrounded / phone locked
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && useChatStore.getState().isSecureSession) {
        closeSecureChat();
      }
    };
    const onBlur = () => {
      if (useChatStore.getState().isSecureSession) closeSecureChat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onBlur);
    };
  }, [closeSecureChat]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [secureVaultOpen, setSecureVaultOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const supabase = createClient();
  const [pinModal, setPinModal] = useState<null | 'setup' | 'unlock'>(null);

  // After login: check if user needs to set up, unlock, or re-verify E2E encryption.
  // Policy:
  //  - No server key       → 'setup'  (mandatory)
  //  - Server key, no local→ 'unlock' (new device / cleared browser storage)
  //  - Server + local key  → 'unlock' only when last verification is older than 7 days
  useEffect(() => {
    if (!user) { setPinModal(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const server = await hasServerKey(user.id);
        if (cancelled) return;
        if (!server) { setPinModal('setup'); return; }

        const local = await hasLocalPrivateKey();
        if (!local) { setPinModal('unlock'); return; }

        // Local key exists — only re-check on the weekly cadence.
        const lastKey = `vt_pin_last_verified_${user.id}`;
        const lastVerified = parseInt(localStorage.getItem(lastKey) || '0', 10);
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const stale = !lastVerified || (Date.now() - lastVerified) > WEEK_MS;

        if (stale) {
          setPinModal('unlock');
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handlePinComplete = () => {
    if (user) {
      try {
        sessionStorage.setItem(`vt_pin_session_${user.id}`, '1');
        localStorage.setItem(`vt_pin_last_verified_${user.id}`, String(Date.now()));
        window.dispatchEvent(new CustomEvent('vt-encryption-unlocked'));
      } catch {}
    }
    setPinModal(null);
  };

  // Load notifications for the current user (admins receive ticket alerts)
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mounted) return;
      setNotifications(data || []);
      setUnreadNotifications((data || []).filter((n: any) => !n.is_read).length);
    };
    load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new as any, ...prev].slice(0, 20));
        setUnreadNotifications((c) => c + 1);
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user]);

  const handleNotifClick = async (n: any) => {
    setNotificationsOpen(false);
    try {
      if (!n.is_read) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
        setUnreadNotifications((c) => Math.max(0, c - 1));
      }
    } catch {}
    if (n.link && typeof window !== 'undefined') {
      window.location.href = n.link;
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setUnreadNotifications(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };
  const [showAppPermPrompt, setShowAppPermPrompt] = useState(false);
  const { permissions, requestNotifications, requestStorage, requestMicAndCamera, checkAllPermissions } = usePermissions();

  // Request app-level permissions once per session after user logs in
  useEffect(() => {
    if (!user) return;
    const key = `vt_perms_requested_${user.id}`;
    const alreadyRequested = localStorage.getItem(key);
    if (!alreadyRequested) {
      // Small delay so the UI is fully rendered first
      const t = setTimeout(() => {
        checkAllPermissions().then(() => {
          setShowAppPermPrompt(true);
        });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, checkAllPermissions]);

  const handleAppPermAllow = async () => {
    setShowAppPermPrompt(false);
      if (user) localStorage.setItem(`vt_perms_requested_${user.id}`, '1');
    // Notifications + storage can be requested in parallel.
    // Microphone + camera need a user-gesture context too — fired right after click.
    await Promise.all([
      requestNotifications(),
      requestStorage(),
      requestMicAndCamera(),
    ]);
  };

  const handleAppPermDeny = () => {
    setShowAppPermPrompt(false);
    if (user) localStorage.setItem(`vt_perms_requested_${user.id}`, '1');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName[0]?.toUpperCase() || 'V';
  const adminUser = isAdmin?.();

  // Auto-close secure vault when screen is locked / tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && secureVaultOpen) {
        setSecureVaultOpen(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [secureVaultOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router({ to: '/sign-in', replace: true });
    } catch {}
  };

  return (
    <CallProvider>
    <div className="gradient-bg-page min-h-screen flex">
      {/* App-level Permission Prompt */}
      {showAppPermPrompt && (
        <PermissionPrompt
          title="Enable App Features"
          subtitle="Allow VibTribe to work smoothly with these permissions."
          permissions={[
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
              label: 'Notifications',
              description: 'Get notified about new messages, calls and status updates',
              status: permissions.notifications,
            },
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
              label: 'Microphone',
              description: 'Required for voice notes and voice/video calls',
              status: permissions.microphone,
            },
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
              label: 'Camera',
              description: 'Required for video calls and capturing media',
              status: permissions.camera,
            },
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
              label: 'Storage',
              description: 'Save media files and app data persistently',
              status: permissions.storage,
            },
          ]}
          onAllow={handleAppPermAllow}
          onDeny={handleAppPermDeny}
          allowLabel="Allow"
          denyLabel="Not Now"
        />
      )}
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col glass-strong border-r border-border transition-all duration-300 ease-in-out fixed top-0 left-0 h-full z-40 ${
          sidebarExpanded ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 px-4 py-5 border-b border-border hover:bg-muted/40 transition-colors" aria-label="Go to Chats">
          <div className="flex-shrink-0">
            <AppLogo size={36} />
          </div>
          {sidebarExpanded && (
            <span className="font-bold text-xl text-gradient-primary tracking-tight">VibTribe</span>
          )}
        </Link>

        {/* Nav Items */}
        <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={`nav-${item.label.toLowerCase()}`}
                to={item.href}
                preload="render"
                className={`relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'gradient-primary text-white glow-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Icon size={22} />
                </div>
                {sidebarExpanded && <span className="font-medium text-sm">{item.label}</span>}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-3 px-2 py-1 glass rounded-lg text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: User + Collapse */}
        <div className="p-3 border-t border-border">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-all cursor-pointer ${!sidebarExpanded ? 'justify-center' : ''}`}>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                {avatarLetter}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-vt-green rounded-full border-2 border-background" />
            </div>
            {sidebarExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              </div>
            )}
            {sidebarExpanded && (
              <button onClick={handleSignOut} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors" title="Sign Out">
                <LogOut size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-full mt-2 flex items-center justify-center py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            {sidebarExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen min-w-0 max-w-full overflow-x-hidden transition-all duration-300 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Topbar — pad for iOS notch / Dynamic Island so content scrolls below it */}
        <header
          className="glass-strong border-b border-border sticky top-0 z-30 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            height: 'calc(64px + env(safe-area-inset-top))',
          }}
        >
          <div className="flex lg:hidden items-center gap-2 min-w-0 flex-shrink">
            <Link to="/" className="flex-shrink-0" aria-label="Go to Chats">
              <AppLogo size={28} />
            </Link>
            {pageTitle && (
              <span className="font-bold text-base text-foreground truncate">{pageTitle}</span>
            )}
          </div>

          <div className="flex-1 min-w-0" />

          {/* Global Search Bar */}
          <GlobalSearchBar />

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-xs text-vt-green font-medium">
            <Wifi size={12} />
            <span>Online</span>
          </div>

          {/* 🔒 Secure Chats Button */}
          <button
            onClick={() => setSecureVaultOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 gradient-primary text-white rounded-xl border border-primary/60 shadow-md glow-primary hover:opacity-90 transition-all duration-200 group"
            title="Secured Chats"
          >
            <Lock size={16} className="group-hover:animate-pulse" />
            <span className="hidden md:inline text-xs font-semibold">Secured</span>
          </button>

          {/* Help — inline next to Secure */}
          <HelpButton variant="topbar" />

          {/* Admin Shield — only for admin */}
          {adminUser && (
            <Link
              to="/admin"
              className="p-2 sm:p-2.5 glass rounded-xl text-vt-amber hover:bg-vt-amber/10 transition-all"
              title="Admin Panel"
            >
              <Shield size={18} />
            </Link>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden page-enter">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-border z-40 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-around">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`mobile-nav-${item.label.toLowerCase()}`}
                  to={item.href}
                  preload="render"
                  className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <div className="relative">
                    <Icon size={22} />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* PWA Install Banner */}
        <PWAInstallBanner />
      </div>

      <SecureVaultModal isOpen={secureVaultOpen} onClose={() => setSecureVaultOpen(false)} />
      {pinModal && user && (
        <EncryptionPinModal
          userId={user.id}
          mode={pinModal}
          onComplete={handlePinComplete}
          /* No skip — PIN entry is mandatory for setup, new devices, and weekly re-checks */
        />
      )}
    </div>
    </CallProvider>
  );
}