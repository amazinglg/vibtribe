import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ShieldCheck, Mail, User, Phone, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import Wordmark from '@/components/ui/Wordmark'
import { supabase } from '@/integrations/supabase/client'
import {
  submitGuardianDetails,
  verifyGuardianEmailOtp,
  getMyGuardianStatus,
} from '@/lib/guardian.functions'

type Status = {
  id: string
  guardian_name: string
  guardian_email: string
  guardian_mobile: string | null
  relationship: string
  email_verified_at: string | null
  consented_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
} | null

export default function GuardianSetupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  // form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [relationship, setRelationship] = useState<'parent' | 'mother' | 'father' | 'legal_guardian' | 'grandparent' | 'other'>('parent')
  const [otp, setOtp] = useState('')

  const refresh = async () => {
    try {
      const res = await getMyGuardianStatus()
      setStatus((res?.record ?? null) as Status)
    } catch (e: any) {
      setError(e?.message || 'Could not load guardian status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession()
      if (!sess.session) { navigate({ to: '/sign-in', replace: true }); return }
      refresh()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOk('')
    if (!name.trim() || name.trim().length < 2) return setError('Please enter your guardian\u2019s full name')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid guardian email')
    if (mobile.replace(/\D/g, '').length < 7) return setError('Please enter a valid guardian mobile number')
    setSaving(true)
    try {
      await submitGuardianDetails({
        data: {
          guardianName: name.trim(),
          guardianEmail: email.trim().toLowerCase(),
          guardianMobile: mobile.trim(),
          relationship,
        },
      })
      setOk('We\u2019ve emailed a 6-digit code to your guardian. Ask them to share it with you.')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Could not send OTP')
    } finally { setSaving(false) }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOk('')
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code from your guardian')
    setSaving(true)
    try {
      const res = await verifyGuardianEmailOtp({ data: { code: otp } })
      if (!(res as any)?.ok) { setError('That code is invalid or expired. Please resend.'); return }
      setOk('Guardian email verified! We\u2019ve emailed your guardian a consent request link.')
      setOtp('')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Verification failed')
    } finally { setSaving(false) }
  }

  const handleResend = async () => {
    if (!status) return
    setError(''); setOk(''); setSaving(true)
    try {
      // Re-submit with existing details to regenerate OTP
      await submitGuardianDetails({
        data: {
          guardianName: status.guardian_name,
          guardianEmail: status.guardian_email,
          guardianMobile: status.guardian_mobile || '',
          relationship: status.relationship as any,
        },
      })
      setOk('A fresh code has been emailed to your guardian.')
    } catch (e: any) {
      setError(e?.message || 'Could not resend code')
    } finally { setSaving(false) }
  }

  const consented = !!status?.consented_at && !status?.revoked_at
  const awaitingConsent = !!status?.email_verified_at && !status?.consented_at
  const awaitingOtp = !!status && !status?.email_verified_at

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
          <p className="text-muted-foreground text-xs">Guardian consent (DPDP 2023)</p>
        </div>

        <div className="glass-strong rounded-3xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-center w-14 h-14 rounded-full gradient-primary glow-primary mx-auto mb-3">
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h1 className="font-bold text-xl text-foreground mb-1 text-center">Set up guardian consent</h1>
          <p className="text-muted-foreground text-sm mb-5 text-center">
            Because you\u2019re under 18, an adult guardian must approve your VibTribe account before you can chat, call or post.
          </p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : consented ? (
            <div className="text-center py-4">
              <CheckCircle2 className="text-vt-green mx-auto mb-2" size={48} />
              <div className="font-semibold text-foreground mb-1">Your guardian has approved!</div>
              <div className="text-sm text-muted-foreground mb-4">You now have full access to VibTribe.</div>
              <button onClick={() => navigate({ to: '/complete-profile', replace: true })}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold">
                Continue to profile setup
              </button>
            </div>
          ) : awaitingConsent ? (
            <div className="text-center py-3">
              <Mail className="text-primary mx-auto mb-2" size={40} />
              <div className="font-semibold text-foreground mb-1">Waiting for your guardian</div>
              <div className="text-sm text-muted-foreground mb-1">
                We\u2019ve emailed <span className="text-foreground font-medium">{status?.guardian_email}</span> a consent request link.
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                Once they click \u201cI consent\u201d, you\u2019ll get access here automatically.
              </div>
              <button onClick={refresh} className="w-full py-3 rounded-xl border border-border text-foreground flex items-center justify-center gap-2">
                <RefreshCw size={16}/> Check status
              </button>
            </div>
          ) : awaitingOtp ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                We emailed a 6-digit code to <span className="text-foreground font-medium">{status?.guardian_email}</span>.
                Ask your guardian to share it with you and enter it below.
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Verification code</label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground tracking-[0.5em] text-center text-lg font-mono" />
              </div>
              {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={16}/>{error}</div>}
              {ok && <div className="text-vt-green text-sm">{ok}</div>}
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16}/> : null} Verify code
              </button>
              <button type="button" onClick={handleResend} disabled={saving}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground">
                Didn\u2019t receive it? Resend
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitDetails} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Guardian full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-input border border-border text-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Relationship</label>
                <select value={relationship} onChange={e => setRelationship(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground">
                  <option value="parent">Parent</option>
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="legal_guardian">Legal guardian</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Guardian email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guardian@example.com"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-input border border-border text-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Guardian mobile number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 98xxxxxxxx"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-input border border-border text-foreground" />
                </div>
              </div>
              {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={16}/>{error}</div>}
              {ok && <div className="text-vt-green text-sm">{ok}</div>}
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16}/> : null} Send verification code to guardian
              </button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                We\u2019ll email your guardian a 6-digit code plus a consent link. Both steps are required by India\u2019s DPDP Act. You can view or withdraw consent anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}