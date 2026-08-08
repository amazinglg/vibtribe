import React, { useEffect, useState } from 'react';
import { Star, X, Heart, MessageSquareHeart } from 'lucide-react';
import { PLAY_STORE_URL } from '@/components/GooglePlayButton';
import { isNativeWrapper } from '@/lib/native-bridge';
import { useAuth } from '@/contexts/AuthContext';

const KEY = 'vt_rate_prompt_v1';
const SESSION_KEY = 'vt_rate_prompt_shown_session';
const SUPPORT_EMAIL = 'help.vibtribe.in@gmail.com';

type Stored = { status: 'pending' | 'rated' | 'never'; lastDismissed?: number };

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { status: 'pending' };
}

function write(v: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}

/**
 * Friendly two-step Play Store review prompt.
 *  Step 1 — "Enjoying VibTribe?"  → Yes / Not really
 *  Step 2a (Yes)        → Rate on Google Play | Remind me later | Don't ask again
 *  Step 2b (Not really) → Send feedback by email (never shown again after)
 * "Remind me later" reappears on the next app open; rating or opting out is permanent.
 */
export default function RateAppPrompt() {
  const { user } = useAuth();
  const [step, setStep] = useState<'ask' | 'rate' | 'feedback' | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;

    // Play Store reviews only make sense for Android users (native app or Chrome/Android PWA).
    const isAndroid = isNativeWrapper() || /Android/i.test(navigator.userAgent || '');
    if (!isAndroid) return;

    if (read().status !== 'pending') return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch {}

    const t = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      setStep('ask');
    }, 12000);
    return () => clearTimeout(t);
  }, [user]);

  const close = (persist?: Stored) => {
    setClosing(true);
    if (persist) write(persist);
    setTimeout(() => { setStep(null); setClosing(false); }, 200);
  };

  const openPlayStore = () => {
    write({ status: 'rated' });
    try {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = PLAY_STORE_URL;
    }
    close();
  };

  if (!step) return null;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-label="Rate VibTribe"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => close({ status: 'pending', lastDismissed: Date.now() })}
      />

      <div
        className={`relative w-full max-w-sm rounded-3xl border border-border glass shadow-2xl overflow-hidden transition-transform duration-300 ${closing ? 'translate-y-4 sm:translate-y-0 sm:scale-95' : 'translate-y-0 scale-100'}`}
      >
        <div className="absolute -top-20 -right-16 w-48 h-48 gradient-primary rounded-full blur-3xl opacity-25" aria-hidden="true" />

        <button
          onClick={() => close({ status: 'pending', lastDismissed: Date.now() })}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={15} />
        </button>

        <div className="relative p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4">
            {step === 'feedback'
              ? <MessageSquareHeart size={24} className="text-primary-foreground" />
              : step === 'rate'
                ? <Star size={24} className="text-primary-foreground" fill="currentColor" />
                : <Heart size={24} className="text-primary-foreground" fill="currentColor" />}
          </div>

          {step === 'ask' && (
            <>
              <h2 className="text-lg font-bold text-foreground">Enjoying VibTribe?</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                We'd love to know how your experience has been so far.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setStep('feedback')}
                  className="px-4 py-3 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Not really
                </button>
                <button
                  onClick={() => setStep('rate')}
                  className="px-4 py-3 rounded-2xl gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Yes, I like it!
                </button>
              </div>
            </>
          )}

          {step === 'rate' && (
            <>
              <h2 className="text-lg font-bold text-foreground">Rate us on Google Play</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                A quick 5-star review helps more people discover a privacy-first way to chat. It takes less than a minute.
              </p>
              <div className="flex justify-center gap-1 mt-4 text-vt-yellow" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={22} fill="currentColor" className="text-amber-400 drop-shadow" />
                ))}
              </div>
              <div className="mt-5 space-y-2.5">
                <button
                  onClick={openPlayStore}
                  className="w-full px-4 py-3 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Rate on Google Play
                </button>
                <button
                  onClick={() => close({ status: 'pending', lastDismissed: Date.now() })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Remind me later
                </button>
                <button
                  onClick={() => close({ status: 'never' })}
                  className="w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Don't ask me again
                </button>
              </div>
            </>
          )}

          {step === 'feedback' && (
            <>
              <h2 className="text-lg font-bold text-foreground">Tell us what's wrong</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                Sorry to hear that. Share what we can improve — we read every message and reply.
              </p>
              <div className="mt-5 space-y-2.5">
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('VibTribe feedback')}`}
                  onClick={() => close({ status: 'never' })}
                  className="block w-full px-4 py-3 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Send feedback
                </a>
                <button
                  onClick={() => close({ status: 'pending', lastDismissed: Date.now() })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}