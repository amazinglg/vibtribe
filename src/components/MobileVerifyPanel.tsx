// Master-admin-only mobile verification UI (temporary controlled test).
// Talks only to the existing /api/public/phone-verify endpoints.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Loader2, MessageSquare, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Phase = 'idle' | 'starting' | 'awaiting' | 'expired' | 'verified' | 'error';

const FRIENDLY: Record<number, string> = {
  401: 'Your session expired. Please sign in again.',
  429: 'Too many verification attempts. Please try again later.',
  422: 'This verification request is no longer valid. Please try again.',
  503: 'Mobile verification is temporarily unavailable.',
  500: 'Something went wrong. Please try again in a moment.',
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('no_session');
  return { Authorization: `Bearer ${token}` };
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function MobileVerifyPanel({ mobile }: { mobile?: string | null }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null); // memory only
  const [sendTo, setSendTo] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // Initial status check — decides whether "Verify Now" should show at all,
  // and restores an in-flight claim from the backend-authoritative expiry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/phone-verify', { headers: await authHeaders() });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.gateway_number) setSendTo(json.gateway_number);
        if (json?.verified) { setPhase('verified'); return; }
        // Backend is authoritative for expiry: resume the existing pending claim.
        if (json?.pending_expires_at) {
          const ts = new Date(json.pending_expires_at).getTime();
          if (Number.isFinite(ts)) {
            setExpiresAt(ts);
            setPhase(ts > Date.now() ? 'awaiting' : 'expired');
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Countdown driven by the backend expiry.
  useEffect(() => {
    if (!expiresAt || phase !== 'awaiting') return;
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemaining(left);
      if (left <= 0) setPhase('expired');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, phase]);

  // Poll status while awaiting verification (also re-reads backend expiry).
  useEffect(() => {
    if (phase !== 'awaiting') return;
    let stop = false;
    const id = setInterval(async () => {
      if (stop) return;
      try {
        const res = await fetch('/api/public/phone-verify', { headers: await authHeaders() });
        if (!res.ok) {
          if (res.status === 401) { stop = true; setPhase('error'); setError(FRIENDLY[401]); }
          return;
        }
        const json = await res.json();
        if (json?.verified) {
          stop = true;
          setToken(null);
          setPhase('verified');
          return;
        }
        if (json?.pending_expires_at) {
          const ts = new Date(json.pending_expires_at).getTime();
          if (Number.isFinite(ts)) setExpiresAt((prev) => (prev === ts ? prev : ts));
        } else {
          // No pending claim left on the backend → treat as expired.
          stop = true;
          setToken(null);
          setPhase('expired');
        }
      } catch {}
    }, 4000);
    return () => { stop = true; clearInterval(id); };
  }, [phase]);

  const start = useCallback(async () => {
    setError(null);
    setPhase('starting');
    setOpen(true);
    try {
      const res = await fetch('/api/public/phone-verify', { method: 'POST', headers: await authHeaders() });
      if (!res.ok) {
        setPhase('error');
        setError(FRIENDLY[res.status] || 'Unable to start mobile verification right now. Please try again later.');
        return;
      }
      const json = await res.json();
      setToken(json.token);
      if (json.send_to) setSendTo(json.send_to);
      if (!json.expires_at) {
        // Backend must supply the expiry; never invent one client-side.
        setPhase('error');
        setError('Unable to start mobile verification right now. Please try again later.');
        return;
      }
      setExpiresAt(new Date(json.expires_at).getTime());
      setPhase('awaiting');
    } catch {
      setPhase('error');
      setError('Unable to start mobile verification right now. Please try again later.');
    }
  }, []);

  if (phase === 'verified' && !open) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 flex-shrink-0">
        <BadgeCheck size={14} /> Verified
      </span>
    );
  }

  const smsBody = token ? `VIBTRIBE VERIFY ${token}` : '';
  const smsHref = token ? `sms:${sendTo}?body=${encodeURIComponent(smsBody)}` : '#';

  // A pending claim restored from the backend has no raw token (it is memory-only
  // and returned exactly once), so opening the panel must not silently re-claim.
  const pendingWithoutToken = phase === 'awaiting' && !token;

  return (
    <>
      <button
        type="button"
        onClick={pendingWithoutToken ? () => setOpen(true) : start}
        disabled={!mobile}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {pendingWithoutToken ? 'Verification Pending' : 'Verify Now'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-5 space-y-4 mt-6 sm:mt-12 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-base text-foreground">Verify your mobile number</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {phase === 'starting' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Preparing verification…
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <button onClick={start} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                  Try Again
                </button>
              </div>
            )}

            {pendingWithoutToken && (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  A verification is already in progress. Send the code you received earlier to{' '}
                  <span className="font-medium">{sendTo}</span>, or request a new one.
                </p>
                <p className="text-xs text-muted-foreground">Expires in {fmt(remaining)}</p>
                <button onClick={start} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                  <RefreshCw size={14} /> Get a new code
                </button>
              </div>
            )}

            {phase === 'awaiting' && token && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Send the following message from your mobile phone:</p>
                  <div className="p-3 bg-muted/50 rounded-xl text-sm font-mono font-semibold text-foreground break-all">
                    {smsBody}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Send it to:</p>
                  <div className="p-3 bg-muted/50 rounded-xl text-sm font-medium text-foreground">{sendTo}</div>
                </div>
                <a
                  href={smsHref}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  <MessageSquare size={15} /> Send SMS
                </a>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 size={13} className="animate-spin" /> Waiting for verification…
                  </span>
                  <span className="text-muted-foreground font-medium">Expires in {fmt(remaining)}</span>
                </div>
              </div>
            )}

            {phase === 'expired' && (
              <div className="space-y-3">
                <p className="text-sm text-foreground">Verification request expired.</p>
                <button onClick={start} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            )}

            {phase === 'verified' && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <BadgeCheck size={16} /> Mobile number verified
                </p>
                <button onClick={() => setOpen(false)} className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}