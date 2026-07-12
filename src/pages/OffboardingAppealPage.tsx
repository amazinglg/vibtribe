// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ShieldQuestion, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export default function OffboardingAppealPage() {
  const { token } = useParams({ from: '/appeal-offboarding/$token' })
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data, error } = await supabase.rpc('lookup_offboarding_appeal' as any, { _token: token })
      if (error) toast.error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      setRecord(row || null)
      setLoading(false)
    })()
  }, [token])

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error('Please share at least a short explanation (10+ characters).')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('submit_offboarding_appeal' as any, {
        _token: token,
        _reason: reason.trim(),
      })
      if (error) throw error
      setDone(true)
      toast.success('Appeal submitted — a moderator will review it.')
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit appeal')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-800">
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="max-w-md w-full text-center">
          <XCircle className="mx-auto text-red-500" size={40} />
          <h1 className="text-xl font-bold mt-3 text-neutral-900">Appeal link invalid</h1>
          <p className="text-sm text-neutral-600 mt-2">
            This appeal link is invalid, has expired, or has already been used.
            If you need help, please email help.vibtribe.in@gmail.com.
          </p>
        </div>
      </div>
    )
  }

  const status = record.status as string

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="text-indigo-600" size={22} />
          <h1 className="text-xl font-bold">Appeal your account removal</h1>
        </div>

        {status === 'awaiting_submission' && !done && (
          <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
            <p className="text-sm text-neutral-700">
              Hi{record.appellant_name ? ` ${record.appellant_name.split(' ')[0]}` : ''}, if
              you believe your VibTribe account was removed in error, please
              tell us what happened. Our Trust &amp; Safety team will review
              your appeal and respond by email.
            </p>
            <label className="block text-sm font-medium">Why should this decision be reversed?</label>
            <textarea
              rows={6}
              maxLength={4000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Share any context, evidence, or explanation that will help us re-review this decision."
              className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || reason.trim().length < 10}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Submit appeal
            </button>
          </div>
        )}

        {(status === 'pending' || done) && (
          <div className="rounded-2xl border border-neutral-200 p-6 text-center space-y-2">
            <CheckCircle2 className="mx-auto text-green-500" size={40} />
            <h2 className="font-bold">Appeal received</h2>
            <p className="text-sm text-neutral-600">
              A moderator will review your appeal and email you with the outcome.
            </p>
          </div>
        )}

        {status === 'approved' && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 space-y-2">
            <CheckCircle2 className="mx-auto text-green-600" size={40} />
            <h2 className="font-bold text-center">Your appeal was approved</h2>
            <p className="text-sm text-neutral-700 text-center">
              You can now create a new VibTribe account with the same email or
              mobile number.
            </p>
            {record.reviewer_notes && (
              <p className="text-xs text-neutral-600 text-center">
                Moderator notes: {record.reviewer_notes}
              </p>
            )}
          </div>
        )}

        {status === 'rejected' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-2">
            <XCircle className="mx-auto text-red-600" size={40} />
            <h2 className="font-bold text-center">Your appeal was rejected</h2>
            <p className="text-sm text-neutral-700 text-center">
              After review, our team upheld the original decision. The block on
              your email and mobile number remains in place.
            </p>
            {record.reviewer_notes && (
              <p className="text-xs text-neutral-600 text-center">
                Moderator notes: {record.reviewer_notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}