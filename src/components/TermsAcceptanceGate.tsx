import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TermsContent } from '@/components/legal/LegalContent';
import { toast } from 'sonner';

const OFFBOARD_DAYS = 15;

/**
 * Blocking modal shown on app entry to any signed-in user who hasn't yet
 * accepted the current Terms & Conditions / Privacy Policy.
 */
export default function TermsAcceptanceGate() {
  const { user } = useAuth();
  const [needsAccept, setNeedsAccept] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warningSentAt, setWarningSentAt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('terms_accepted_at, privacy_accepted_at, terms_warning_sent_at')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[VT-TERMS] failed to read terms_accepted_at', error);
        return;
      }
      if (!data?.terms_accepted_at || !(data as any)?.privacy_accepted_at) {
        setNeedsAccept(true);
        setWarningSentAt(((data as any)?.terms_warning_sent_at as string | null) ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true);
  };

  const handleAccept = async () => {
    if (!checked) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('accept_terms' as any);
      if (error) throw error;
      setNeedsAccept(false);
      toast.success('Thanks — terms accepted');
    } catch (e: any) {
      console.error('[VT-TERMS] accept failed', e);
      toast.error(e?.message || 'Could not record acceptance. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !needsAccept) return null;

  let deadlineText: string | null = null;
  let daysLeft: number | null = null;
  if (warningSentAt) {
    const deadline = new Date(new Date(warningSentAt).getTime() + OFFBOARD_DAYS * 86400_000);
    daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400_000));
    deadlineText = deadline.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ paddingBottom: 'max(1rem, calc(var(--safe-bottom-app, 0px) + 1rem))' }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <ShieldCheck size={20} className="text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">Updated Terms &amp; Privacy</h2>
            <p className="text-xs text-muted-foreground">Please review and accept to continue using VibTribe.</p>
          </div>
        </div>

        {deadlineText && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>Action required by {deadlineText}</strong>
              {typeof daysLeft === 'number' && (
                <> · {daysLeft === 0 ? 'final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</>
              )}.
              If you don't accept within this window, your VibTribe account will be offboarded from the platform.
            </p>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <TermsContent />
          <div className="h-2" />
        </div>

        <div className="px-5 py-4 border-t border-border bg-background/60 space-y-3">
          {!scrolledToEnd && (
            <p className="text-[11px] text-muted-foreground text-center">
              Scroll to the bottom to enable acceptance.
            </p>
          )}
          <label className={`flex items-start gap-2.5 select-none ${scrolledToEnd ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
            <button
              type="button"
              disabled={!scrolledToEnd}
              onClick={() => setChecked(v => !v)}
              aria-pressed={checked}
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${checked ? 'bg-primary border-primary' : 'bg-input border-border'}`}
            >
              {checked && <Check size={13} className="text-white" />}
            </button>
            <span className="text-xs text-foreground/90 leading-relaxed">
              I have read and accept VibTribe's Terms &amp; Conditions and Privacy Policy.
            </span>
          </label>
          <button
            disabled={!checked || submitting}
            onClick={handleAccept}
            className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : (
              <>Accept &amp; Continue</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
