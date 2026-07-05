// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Copy, Check, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { generateBase32Secret, otpauthUri, verifyTotp } from '@/lib/totp';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Step = 'intro' | 'scan' | 'verify' | 'done';

export default function TotpEnrollDialog({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState<Step>('intro');
  const [secret, setSecret] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('intro'); setSecret(''); setQrDataUrl(''); setCode(''); setError(''); setBusy(false); setCopied(false);
    }
  }, [open]);

  const accountLabel = profile?.real_email || profile?.email || profile?.username || user?.id || 'account';

  const startEnrollment = async () => {
    setBusy(true); setError('');
    try {
      const s = generateBase32Secret(20);
      const uri = otpauthUri({ secret: s, account: accountLabel, issuer: 'VibTribe' });
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 280, color: { dark: '#000000', light: '#ffffff' } });
      const { error: rpcErr } = await supabase.rpc('start_totp_enrollment', { _secret: s });
      if (rpcErr) throw new Error(rpcErr.message);
      setSecret(s); setQrDataUrl(qr); setStep('scan');
    } catch (e: any) {
      setError(e?.message || 'Could not start 2FA enrollment.');
    } finally { setBusy(false); }
  };

  const cancelEnrollment = async () => {
    try { await supabase.rpc('cancel_totp_enrollment'); } catch {}
    onClose();
  };

  const confirmCode = async () => {
    setBusy(true); setError('');
    try {
      if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your Authenticator app.'); setBusy(false); return; }
      const ok = await verifyTotp(secret, code);
      if (!ok) {
        // wrong code — keep pending enrollment so user can try again
        setError('That code is incorrect. Open Google Authenticator and try the latest 6-digit code.');
        setBusy(false);
        return;
      }
      const { error: rpcErr } = await supabase.rpc('confirm_totp_enrollment', { _code: code });
      if (rpcErr) throw new Error(rpcErr.message);
      setStep('done');
      toast.success('Two-factor authentication enabled ✅');
      onEnabled();
    } catch (e: any) {
      // restart on hard failure
      try { await supabase.rpc('cancel_totp_enrollment'); } catch {}
      setError((e?.message || 'Something went wrong, please try again.') + ' Restarting setup…');
      setTimeout(() => { setStep('intro'); setError(''); setSecret(''); setQrDataUrl(''); setCode(''); }, 1800);
    } finally { setBusy(false); }
  };

  const copySecret = async () => {
    try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  if (!open) return null;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
      onClick={cancelEnrollment}
    >
      <div
        className="glass-strong rounded-3xl border border-border w-full max-w-md p-5 sm:p-6 max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-24px)] overflow-y-auto my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Shield size={16} /></div>
            <h3 className="font-bold text-base text-foreground">Enable 2-step verification</h3>
          </div>
          <button onClick={cancelEnrollment} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {error && (
          <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'intro' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Protect your VibTribe account with a 6-digit code from <strong className="text-foreground">Google Authenticator</strong> (or any compatible authenticator app).
            </p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-5">
              <li>Install Google Authenticator on your phone.</li>
              <li>Tap <em>Continue</em>, scan the QR code (or enter the key manually).</li>
              <li>Type the 6-digit code your app shows to confirm.</li>
              <li>From next sign-in you'll be asked for that code along with your password.</li>
            </ol>
            <div className="flex gap-2 pt-2">
              <button onClick={cancelEnrollment} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground">Cancel</button>
              <button onClick={startEnrollment} disabled={busy} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold gradient-primary text-white">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Continue
              </button>
            </div>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Scan this QR code in Google Authenticator, then tap <em>I've scanned it</em>.</p>
            {qrDataUrl && (
              <div className="bg-white p-3 rounded-2xl mx-auto w-fit"><img src={qrDataUrl} alt="2FA QR code" className="w-56 h-56 block" /></div>
            )}
            <div className="text-center">
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Can't scan? Enter this key manually</p>
              <button onClick={copySecret} className="inline-flex items-center gap-1.5 text-sm font-mono font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg break-all">
                {secret}{copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={cancelEnrollment} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground">Cancel</button>
              <button onClick={() => setStep('verify')} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold gradient-primary text-white">I've scanned it</button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Open Google Authenticator and enter the current 6-digit code for <strong>VibTribe</strong>.</p>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                inputMode="numeric"
                autoFocus
                placeholder="123 456"
                maxLength={6}
                className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-xl text-foreground text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('scan')} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground">Back</button>
              <button onClick={confirmCode} disabled={busy || code.length !== 6} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold gradient-primary text-white disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Verify & enable
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 text-center py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-vt-green/20 text-vt-green flex items-center justify-center"><Check size={28} /></div>
            <h4 className="font-bold text-foreground">2-step verification is on</h4>
            <p className="text-xs text-muted-foreground">From your next sign-in, VibTribe will ask for the 6-digit code from your Authenticator app.</p>
            <button onClick={onClose} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold gradient-primary text-white mt-3">Done</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}