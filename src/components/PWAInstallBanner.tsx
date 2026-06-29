import React, { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useNavigate } from '@tanstack/react-router';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Global store so the prompt event survives component unmount/remount
let _cachedPrompt: BeforeInstallPromptEvent | null = null;

// Capture the prompt as early as possible (before React mounts the banner)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _cachedPrompt = e as BeforeInstallPromptEvent;
    // Notify any listeners (e.g. Install button in profile)
    window.dispatchEvent(new CustomEvent('vt:install-available'));
  });
}

// Helper exported for components that want to trigger install programmatically
export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_cachedPrompt) return 'unavailable';
  try {
    await _cachedPrompt.prompt();
    const { outcome } = await _cachedPrompt.userChoice;
    if (outcome === 'accepted') _cachedPrompt = null;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

export function isPwaInstallAvailable(): boolean {
  return _cachedPrompt !== null;
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallBanner() {
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't promote a download inside a native wrapper (Capacitor) or already-installed PWA.
    const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.();
    if (isNative) return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const dismissed = sessionStorage.getItem('vt-download-banner-dismissed');
    if (dismissed) return;

    const ua = navigator.userAgent;
    const ios =
      (/iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    timerRef.current = setTimeout(() => setShowBanner(true), 2500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('vt-download-banner-dismissed', '1');
    setShowBanner(false);
  };

  const handleGetApp = () => {
    setShowBanner(false);
    navigate({ to: isIOS ? '/download/ios' : '/download/android' });
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50 float-up">
      <button
        type="button"
        onClick={handleGetApp}
        className="w-full text-left glass-strong rounded-2xl border border-primary/30 p-4 shadow-card hover:bg-primary/5 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 glow-primary">
            <AppLogo size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-foreground">Get the VibTribe app</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isIOS
                    ? 'Tap to view iPhone install guide'
                    : 'Tap to download the Android app (v1.2.2)'}
                </p>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                role="button"
                aria-label="Dismiss"
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
              >
                <X size={14} />
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-xl text-xs font-semibold glow-primary">
              <Download size={12} />
              <span>{isIOS ? 'View install guide' : 'Download app'}</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
