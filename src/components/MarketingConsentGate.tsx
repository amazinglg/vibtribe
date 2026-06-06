import { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyMarketingConsent, recordMarketingConsent } from '@/lib/marketing.functions';
import { toast } from 'sonner';

/**
 * Shown once after login to existing users who have never answered the
 * marketing-consent question. DPDP/GDPR require explicit opt-in — until
 * they answer, they receive zero promotional email (default-off in DB).
 *
 * "Decide later" hides the modal for 7 days. After 3 deferrals we stop
 * prompting and treat the user as opted-out.
 */
const STORAGE_KEY_PREFIX = 'vt_marketing_consent_';
const ANSWERED_KEY_PREFIX = 'vt_marketing_answered_';
const MAX_PROMPTS = 3;
const DEFER_MS = 7 * 24 * 60 * 60 * 1000;

export default function MarketingConsentGate() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Fast path: if we've already recorded an answer for this user in this browser, never prompt again.
        if (localStorage.getItem(`${ANSWERED_KEY_PREFIX}${user.id}`)) return;
        const res = await getMyMarketingConsent();
        if (cancelled) return;
        if (res?.hasAnswered) {
          try { localStorage.setItem(`${ANSWERED_KEY_PREFIX}${user.id}`, 'server'); } catch {}
          return;
        }
        const key = `${STORAGE_KEY_PREFIX}${user.id}`;
        const raw = localStorage.getItem(key);
        const state = raw ? JSON.parse(raw) : { count: 0, deferredUntil: 0 };
        if (state.count >= MAX_PROMPTS) return;
        if (state.deferredUntil && Date.now() < state.deferredUntil) return;
        // small delay so the app finishes mounting first
        setTimeout(() => { if (!cancelled) setShow(true); }, 1200);
      } catch { /* ignore — gate is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const decide = async (optIn: boolean) => {
    setSubmitting(optIn ? 'yes' : 'no');
    try {
      await recordMarketingConsent({ data: { optIn, source: 'reconsent_modal' } });
      try { localStorage.setItem(`${ANSWERED_KEY_PREFIX}${user!.id}`, String(Date.now())); } catch {}
      toast.success(optIn ? 'Subscribed — thanks!' : 'Got it — no promotional emails.');
      setShow(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save your choice');
    } finally {
      setSubmitting(null);
    }
  };

  const defer = () => {
    if (!user) return;
    const key = `${STORAGE_KEY_PREFIX}${user.id}`;
    const raw = localStorage.getItem(key);
    const state = raw ? JSON.parse(raw) : { count: 0, deferredUntil: 0 };
    const next = { count: (state.count || 0) + 1, deferredUntil: Date.now() + DEFER_MS };
    localStorage.setItem(key, JSON.stringify(next));
    setShow(false);
  };

  if (!user || !show) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-5 border-b border-border flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full gradient-primary flex items-center justify-center glow-primary">
            <Mail size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Stay in the loop?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              We're updating how we handle email. Would you like to receive product updates, tips, and announcements from VibTribe?
            </p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You can change this anytime in <strong>Profile → Notifications</strong>. Security and account emails (OTP, password reset, ticket replies) are sent regardless of your choice.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              disabled={!!submitting}
              onClick={() => decide(true)}
              className="w-full gradient-primary text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting === 'yes' ? <Loader2 size={16} className="animate-spin" /> : 'Yes, subscribe me'}
            </button>
            <button
              disabled={!!submitting}
              onClick={() => decide(false)}
              className="w-full bg-muted text-foreground font-medium py-2.5 rounded-xl hover:bg-muted/80 transition-all disabled:opacity-50"
            >
              {submitting === 'no' ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'No thanks'}
            </button>
            <button
              disabled={!!submitting}
              onClick={defer}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
            >
              Decide later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}