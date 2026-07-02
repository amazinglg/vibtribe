import React, { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import Wordmark from '@/components/ui/Wordmark'
import {
  getGuardianConsentByToken,
  recordGuardianConsentPublic,
  revokeGuardianConsentPublic,
} from '@/lib/guardian.functions'

type Rec = {
  guardian_name: string
  guardian_email: string
  relationship: string
  minor_full_name: string | null
  minor_username: string | null
  minor_dob: string | null
  consented_at: string | null
  revoked_at: string | null
  graduated_at: string | null
} | null

export default function GuardianConsentPage() {
  const { token } = useParams({ from: '/guardian-consent/$token' }) as { token: string }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [record, setRecord] = useState<Rec>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  const load = async () => {
    try {
      const res = await getGuardianConsentByToken({ data: { token } })
      setRecord((res?.record ?? null) as Rec)
    } catch (e: any) {
      setError(e?.message || 'Invalid or expired consent link')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [token])

  const consent = async () => {
    if (!acknowledged) return setError('Please tick the confirmation box to continue.')
    setSaving(true); setError(''); setOk('')
    try {
      await recordGuardianConsentPublic({ data: { token } })
      setOk('Thank you. Your consent has been recorded.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not record consent')
    } finally { setSaving(false) }
  }

  const revoke = async () => {
    if (!confirm('Withdraw your consent? Their account will be restricted immediately.')) return
    setSaving(true); setError(''); setOk('')
    try {
      await revokeGuardianConsentPublic({ data: { token } })
      setOk('Your consent has been withdrawn.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not revoke consent')
    } finally { setSaving(false) }
  }

  const displayMinor = record?.minor_full_name || record?.minor_username || 'a young user'
  const consented = !!record?.consented_at && !record?.revoked_at
  const revoked = !!record?.revoked_at

  return (
    <div className="gradient-bg-page min-h-screen w-full flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto px-4"
      style={{
        paddingTop: 'min(var(--safe-top), 2.25rem)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}>
      <div className="relative w-full max-w-md pt-4 pb-8">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <AppLogo size={40} /><Wordmark className="text-2xl" />
          </div>
          <p className="text-muted-foreground text-xs">Guardian consent portal</p>
        </div>
        <div className="glass-strong rounded-3xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-center w-14 h-14 rounded-full gradient-primary glow-primary mx-auto mb-3">
            <ShieldCheck size={26} className="text-white" />
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary"/></div>
          ) : !record ? (
            <div className="text-center">
              <XCircle className="text-red-400 mx-auto mb-2" size={40}/>
              <div className="font-semibold text-foreground">Invalid or expired link</div>
              <div className="text-sm text-muted-foreground mt-1">Please ask them to request a new consent email.</div>
            </div>
          ) : revoked ? (
            <div className="text-center">
              <XCircle className="text-red-400 mx-auto mb-2" size={40}/>
              <div className="font-semibold text-foreground">Consent withdrawn</div>
              <div className="text-sm text-muted-foreground mt-1">Their account is now restricted.</div>
            </div>
          ) : consented ? (
            <>
              <div className="text-center mb-4">
                <CheckCircle2 className="text-vt-green mx-auto mb-2" size={40}/>
                <div className="font-semibold text-foreground">Consent recorded</div>
                <div className="text-sm text-muted-foreground mt-1">Thank you, {record.guardian_name}.</div>
              </div>
              <div className="rounded-xl bg-input/60 border border-border p-3 text-xs text-muted-foreground mb-4">
                You can withdraw your consent at any time using the button below. Consent automatically expires when {displayMinor} turns 18.
              </div>
              <button onClick={revoke} disabled={saving}
                className="w-full py-3 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10">
                {saving ? 'Working\u2026' : 'Withdraw my consent'}
              </button>
              {ok && <div className="text-vt-green text-sm mt-3 text-center">{ok}</div>}
            </>
          ) : (
            <>
              <h1 className="font-bold text-xl text-foreground mb-2 text-center">Consent request</h1>
              <p className="text-sm text-muted-foreground text-center mb-4">
                <span className="text-foreground font-medium">{displayMinor}</span> has signed up for VibTribe and listed you (<span className="text-foreground">{record.guardian_name}</span>) as their {record.relationship}.
              </p>
              <div className="rounded-xl bg-input/60 border border-border p-3 text-xs text-muted-foreground space-y-2 mb-4">
                <p><strong className="text-foreground">Under DPDP 2023</strong>, we need your verifiable consent before {displayMinor} can chat, call, share media or use age-restricted features on VibTribe.</p>
                <p>By consenting you confirm you are their parent or legal guardian and that they may use VibTribe under your supervision.</p>
                <p>You can withdraw this consent at any time from this page (bookmark it) or via the same link in any reminder email.</p>
              </div>
              <label className="flex items-start gap-2 mb-3 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1 accent-primary"/>
                <span>I confirm I am {displayMinor}\u2019s parent or legal guardian and I consent to their use of VibTribe.</span>
              </label>
              {error && <div className="flex items-center gap-2 text-red-400 text-sm mb-2"><AlertCircle size={16}/>{error}</div>}
              <button onClick={consent} disabled={saving || !acknowledged}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold disabled:opacity-50">
                {saving ? 'Recording\u2026' : 'I consent'}
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Learn more: <a href="/data-notice" className="underline">Data notice</a> · <a href="/privacy" className="underline">Privacy policy</a>
        </p>
      </div>
    </div>
  )
}