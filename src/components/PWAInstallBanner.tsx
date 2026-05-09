import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions banner
      setShowBanner(true);
      return;
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } catch {}
    setInstalling(false);
  };

  const handleDismiss = () => {
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
                    ? 'Tap Share → "Add to Home Screen" to install' :'Add to your home screen for the best experience'}
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
              <div className="flex items-center gap-2 mt-2 p-2 bg-primary/10 rounded-xl">
                <Smartphone size={14} className="text-primary flex-shrink-0" />
                <p className="text-[11px] text-primary">
                  Tap <strong>Share</strong> (↑) then <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
