// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import AppLogo from '@/components/ui/AppLogo';
import { MessageCircle, CircleDot, User, Bell, Shield, Lock, ChevronLeft, ChevronRight, Wifi, LogOut } from 'lucide-react';
import SecureVaultModal from './SecureVaultModal';
import { useAuth } from '@/contexts/AuthContext';
import PWAInstallBanner from './PWAInstallBanner';
import GlobalSearchBar from './GlobalSearchBar';
import Icon from '@/components/ui/AppIcon';
import HelpButton from '@/components/HelpButton';
import PermissionPrompt from '@/components/PermissionPrompt';
import { usePermissions } from '@/hooks/usePermissions';
import { useChatStore } from '@/store/chatStore';



const NAV_ITEMS = [
  { href: '/', label: 'Chats', icon: MessageCircle, badge: 0 },
  { href: '/status-screen', label: 'Status', icon: CircleDot, badge: 0 },
  { href: '/profile-screen', label: 'Profile', icon: User, badge: 0 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useLocation().pathname;
  const router = useNavigate();
  const { user, profile, signOut, isAdmin } = useAuth();
  const { isSecureSession, closeSecureChat } = useChatStore();

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
  const [showAppPermPrompt, setShowAppPermPrompt] = useState(false);
  const { permissions, requestNotifications, requestStorage, requestMicAndCamera, checkAllPermissions } = usePermissions();

  // Request app-level permissions once per session after user logs in
  useEffect(() => {
    if (!user) return;
    const key = `vt_perms_requested_${user.id}`;
    const alreadyRequested = sessionStorage.getItem(key);
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
    if (user) sessionStorage.setItem(`vt_perms_requested_${user.id}`, '1');
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
    if (user) sessionStorage.setItem(`vt_perms_requested_${user.id}`, '1');
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
    <div className="gradient-bg-page min-h-screen flex">
      {/* App-level Permission Prompt */}
      {showAppPermPrompt && (
        <PermissionPrompt
          title="Enable App Features"
          subtitle="Allow VibeTribe to work smoothly with these permissions."
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="flex-shrink-0">
            <AppLogo size={36} />
          </div>
          {sidebarExpanded && (
            <span className="font-bold text-xl text-gradient-primary tracking-tight">VibeTribe</span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={`nav-${item.label.toLowerCase()}`}
                to={item.href}
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
                <p className="text-xs text-muted-foreground truncate">{adminUser ? 'Master Admin' : 'Member'}</p>
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
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Topbar */}
        <header className="glass-strong border-b border-border sticky top-0 z-30 h-16 flex items-center px-4 lg:px-6 gap-4">
          <div className="flex lg:hidden items-center gap-2">
            <AppLogo size={32} />
            <span className="font-bold text-lg text-gradient-primary">VibeTribe</span>
          </div>

          <div className="flex-1" />

          {/* Global Search Bar */}
          <GlobalSearchBar />

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-xs text-vt-green font-medium">
            <Wifi size={12} />
            <span>Online</span>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 glass rounded-xl text-muted-foreground hover:text-foreground transition-all"
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink rounded-full animate-pulse" />
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-2xl border border-border shadow-card overflow-hidden z-50 float-up">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                  <button
                    className="text-xs text-primary hover:text-primary/80"
                    onClick={() => setUnreadNotifications(0)}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="px-4 py-6 text-center">
                  <Bell size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No new notifications</p>
                </div>
              </div>
            )}
          </div>

          {/* 🔒 Secure Chats Button */}
          <button
            onClick={() => setSecureVaultOpen(true)}
            className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-all duration-200 hover:glow-primary group"
          >
            <Lock size={16} className="group-hover:animate-pulse" />
            <span className="hidden sm:inline text-xs font-semibold">Secure</span>
          </button>

          {/* Admin Shield — only for admin */}
          {adminUser && (
            <Link
              to="/admin"
              className="p-2.5 glass rounded-xl text-vt-amber hover:bg-vt-amber/10 transition-all"
              title="Admin Panel"
            >
              <Shield size={20} />
            </Link>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 page-enter">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-border z-40 px-2 py-2">
          <div className="flex items-center justify-around">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`mobile-nav-${item.label.toLowerCase()}`}
                  to={item.href}
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
            <button
              onClick={() => setSecureVaultOpen(true)}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-primary transition-all duration-200"
            >
              <Lock size={22} />
              <span className="text-[10px] font-medium">Secure</span>
            </button>
          </div>
        </nav>

        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Floating Help Button */}
        <HelpButton variant="floating" />
      </div>

      <SecureVaultModal isOpen={secureVaultOpen} onClose={() => setSecureVaultOpen(false)} />
    </div>
  );
}