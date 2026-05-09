import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLocation as _useLocation, useNavigate as _useNavigate } from '@tanstack/react-router';
import AppLogo from '@/components/ui/AppLogo';
import { MessageCircle, CircleDot, User, Bell, Search, Settings, Shield, Lock, ChevronLeft, ChevronRight, Wifi, LogOut } from 'lucide-react';
import SecureVaultModal from './SecureVaultModal';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import PWAInstallBanner from './PWAInstallBanner';

function useRouter() {
  const navigate = _useNavigate();
  return {
    push: (to: string) => navigate({ to: to as any }),
    replace: (to: string) => navigate({ to: to as any, replace: true }),
    back: () => { if (typeof window !== 'undefined') window.history.back(); },
    refresh: () => {},
  };
}



const NAV_ITEMS = [
  { href: '/', label: 'Chats', icon: MessageCircle, badge: 0 },
  { href: '/status-screen', label: 'Status', icon: CircleDot, badge: 0 },
  { href: '/profile-screen', label: 'Profile', icon: User, badge: 0 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, isAdmin } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [secureVaultOpen, setSecureVaultOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName[0]?.toUpperCase() || 'V';
  const adminUser = isAdmin?.();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/sign-in');
    } catch {}
  };

  return (
    <div className="gradient-bg-page min-h-screen flex">
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
                href={item.href}
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

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 group relative"
            >
              <Bell size={22} />
              <span className="absolute top-2 left-6 w-2 h-2 bg-pink rounded-full" />
              {sidebarExpanded && <span className="font-medium text-sm">Notifications</span>}
            </button>
            <Link
              href="/profile-screen"
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 group relative"
            >
              <Settings size={22} />
              {sidebarExpanded && <span className="font-medium text-sm">Settings</span>}
            </Link>
            {adminUser && (
              <Link
                href="/admin"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                  pathname === '/admin' ? 'text-vt-amber bg-vt-amber/10' : 'text-vt-amber hover:bg-vt-amber/10'
                }`}
              >
                <Shield size={22} />
                {sidebarExpanded && <span className="font-medium text-sm">Admin Panel</span>}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-3 px-2 py-1 glass rounded-lg text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                    Admin Panel
                  </div>
                )}
              </Link>
            )}
          </div>
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

          <button className="hidden sm:flex items-center gap-2 px-3 py-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all text-sm">
            <Search size={16} />
            <span className="hidden md:inline">Search...</span>
          </button>

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
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink rounded-full animate-pulse" />
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-2xl border border-border shadow-card overflow-hidden z-50 float-up">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                  <button className="text-xs text-primary hover:text-primary/80">Mark all read</button>
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
              href="/admin"
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
                  href={item.href}
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
      </div>

      <SecureVaultModal isOpen={secureVaultOpen} onClose={() => setSecureVaultOpen(false)} />
      <PWAInstallBanner />
    </div>
  );
}