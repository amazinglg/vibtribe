import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Smartphone, Share } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(_cachedPrompt);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if user already dismissed
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
    if (dismissed) return;

    // Detect iOS (iPhone, iPad, iPod)
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    // Also detect iOS 13+ iPad which reports as MacIntel
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIOSDevice = ios || isIpadOS;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after a short delay post-login
      timerRef.current = setTimeout(() => setShowBanner(true), 2500);
      return;
    }

    // If we already have a cached prompt from before login, show immediately
    if (_cachedPrompt) {
      setDeferredPrompt(_cachedPrompt);
      timerRef.current = setTimeout(() => setShowBanner(true), 2000);
    }

    // Listen for beforeinstallprompt — can fire on this page too
    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      _cachedPrompt = prompt;
      setDeferredPrompt(prompt);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        _cachedPrompt = null;
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } catch {}
    setInstalling(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    setShowBanner(false);
  };

  if (!showBanner || isStandalone) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50 float-up">
      <div className="glass-strong rounded-2xl border border-primary/30 p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 glow-primary">
            <AppLogo size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-foreground">Install VibeTribe</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isIOS
                    ? 'Add to your Home Screen for the best experience'
                    : 'Add to your home screen for the best experience'}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {!isIOS && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  disabled={installing || !deferredPrompt}
                  className="flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-60 glow-primary"
                >
                  {installing ? (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Download size={12} />
                  )}
                  <span>{installing ? 'Installing...' : 'Install App'}</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 glass rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all"
                >
                  Not now
                </button>
              </div>
            )}

            {isIOS && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-primary/10 rounded-xl">
                  <Share size={14} className="text-primary flex-shrink-0" />
                  <p className="text-[11px] text-primary font-medium">
                    Step 1: Tap the <strong>Share</strong> button (↑) in Safari
                  </p>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-primary/10 rounded-xl">
                  <Smartphone size={14} className="text-primary flex-shrink-0" />
                  <p className="text-[11px] text-primary font-medium">
                    Step 2: Tap <strong>"Add to Home Screen"</strong> then <strong>"Add"</strong>
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  ⚠️ Must use Safari browser on iPhone/iPad
                </p>
                <button
                  onClick={handleDismiss}
                  className="w-full px-3 py-2 glass rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all text-center"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
