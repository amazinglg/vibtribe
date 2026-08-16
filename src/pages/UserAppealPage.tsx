// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, ShieldQuestion, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { submitAppeal } from '@/lib/appeals.functions'

export default function UserAppealPage() {
  const params = useParams({ from: '/appeal/$reportId' })
  const reportId = params.reportId
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [existing, setExisting] = useState<any>(null)
  const [reportInfo, setReportInfo] = useState<any>(null)
  const submit = useServerFn(submitAppeal)

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/sign-in' })
  }, [loading, user, navigate])

  useEffect(() => {
    if (!user || !reportId) return
    ;(async () => {
      const { data: rep } = await supabase
        .rpc('get_my_report_status' as any, { _report_id: reportId })
      setReportInfo(Array.isArray(rep) ? rep[0] ?? null : rep)
      const { data: ex } = await supabase
        .from('report_appeals' as any)
        .select('id, status, reason, reviewer_notes, reviewed_at, created_at')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setExisting(ex)
    })()
  }, [user, reportId])

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error('Please provide at least a short explanation (10+ characters).')
      return
    }
    setSubmitting(true)
    try {
      await submit({ data: { reportId, reason: reason.trim() } })
      setDone(true)
      toast.success('Appeal submitted — a moderator will review it.')
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit appeal')
    }
    setSubmitting(false)
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen gradient-bg-profile">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => history.back()} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldQuestion className="text-primary" size={22} />
            <h1 className="text-xl font-bold">Appeal a moderation decision</h1>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 border border-border text-sm space-y-2">
          <p className="text-muted-foreground">
            If you believe a decision was made in error, tell us what happened. Our moderation team will review your appeal and respond in-app.
          </p>
          {reportInfo && (
            <p className="text-xs text-muted-foreground">
              Report reference: <span className="font-mono">{reportInfo.id.slice(0, 8)}…</span> · Type: {reportInfo.report_type} · Action: {reportInfo.action_taken || '—'}
            </p>
          )}
        </div>

        {done || (existing && existing.status === 'pending') ? (
          <div className="glass rounded-2xl p-6 border border-border text-center space-y-2">
            <CheckCircle2 className="mx-auto text-green-400" size={40} />
            <h2 className="font-bold">Appeal received</h2>
            <p className="text-sm text-muted-foreground">A moderator will review your appeal. You&apos;ll get an in-app notification with the outcome.</p>
          </div>
        ) : existing && existing.status !== 'pending' ? (
          <div className="glass rounded-2xl p-6 border border-border space-y-2">
            <h2 className="font-bold">
              Your previous appeal was {existing.status === 'approved' ? 'approved' : 'rejected'}
            </h2>
            {existing.reviewer_notes && (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground/70">Moderator notes:</span> {existing.reviewer_notes}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Reviewed on {existing.reviewed_at ? new Date(existing.reviewed_at).toLocaleString() : ''}
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 border border-border space-y-3">
            <label className="block text-sm font-medium">Why should this decision be reversed?</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Share any context that will help our moderators re-review this. Be specific and honest."
              className="w-full rounded-lg bg-background/40 border border-border p-3 text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || reason.trim().length < 10}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Submit appeal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}