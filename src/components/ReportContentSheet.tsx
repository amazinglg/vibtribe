import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldAlert, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import { submitReport } from '@/lib/reports.functions'

export type ReportType = 'message' | 'image' | 'video' | 'file' | 'audio' | 'profile' | 'chat' | 'status' | 'tribe'
export type ReportReason =
  | 'child_safety' | 'nudity_sexual' | 'harassment_bullying' | 'hate_speech' | 'violence' | 'spam'
  | 'scam_fraud' | 'fake_profile' | 'impersonation' | 'terrorism' | 'illegal_activity'
  | 'self_harm' | 'privacy_violation' | 'copyright' | 'other'

const REASONS: { id: ReportReason; label: string; hint?: string }[] = [
  { id: 'child_safety', label: 'Child Safety / Minor Exploitation', hint: 'Highest priority — reviewed first' },
  { id: 'nudity_sexual', label: 'Nudity or Sexual Content' },
  { id: 'harassment_bullying', label: 'Harassment or Bullying' },
  { id: 'hate_speech', label: 'Hate Speech' },
  { id: 'violence', label: 'Violence' },
  { id: 'spam', label: 'Spam' },
  { id: 'scam_fraud', label: 'Scam / Fraud' },
  { id: 'fake_profile', label: 'Fake Profile' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'terrorism', label: 'Terrorism or Extremism' },
  { id: 'illegal_activity', label: 'Illegal Activity' },
  { id: 'self_harm', label: 'Self-harm or Suicide Concern' },
  { id: 'privacy_violation', label: 'Privacy Violation' },
  { id: 'copyright', label: 'Copyright Violation' },
  { id: 'other', label: 'Other' },
]

export interface ReportContentSheetProps {
  open: boolean
  onClose: () => void
  reportType: ReportType
  reportedUserId?: string
  chatId?: string
  messageId?: string
  statusId?: string
  targetRef?: string
  /** Client-provided decrypted snapshot of the reported item. */
  snapshot?: {
    text?: string
    messageType?: string
    createdAt?: string
    profile?: { id?: string; full_name?: string; username?: string; avatar_url?: string | null }
    chatMeta?: { id?: string; name?: string; type?: string }
    status?: { id?: string; content?: string; media_type?: string; background_color?: string }
    mediaBase64?: string
    mediaMime?: string
    mediaName?: string
  }
}

export default function ReportContentSheet(props: ReportContentSheetProps) {
  const { open, onClose, reportType, reportedUserId, chatId, messageId, statusId, targetRef, snapshot } = props
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = useServerFn(submitReport)

  if (!open) return null

  const submitLabel = {
    message: 'message', image: 'image', video: 'video', file: 'file', audio: 'voice note',
    profile: 'user', chat: 'chat', status: 'status', tribe: 'tribe',
  }[reportType]

  async function handleSubmit() {
    if (!reason) return
    if (reason === 'other' && !comments.trim()) {
      toast.error('Please describe the issue.')
      return
    }
    setSubmitting(true)
    try {
      await submit({
        data: {
          reportType,
          reason,
          comments: comments.trim() || undefined,
          reportedUserId,
          chatId,
          messageId,
          statusId,
          targetRef,
          snapshot: snapshot || {},
        },
      })
      toast.success('Thank you. Your report has been submitted for review.')
      setReason(null)
      setComments('')
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit report')
    } finally {
      setSubmitting(false)
    }
  }

  const sheet = (
    <div
      className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border sm:rounded-2xl rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-card flex flex-col float-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-foreground">Report {submitLabel}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Help us keep VibTribe safe.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {(reportType === 'chat' || reportType === 'tribe' || reportType === 'profile') && !snapshot?.mediaBase64 && !snapshot?.text && (
            <div className="mb-3 rounded-xl border border-vt-amber/30 bg-vt-amber/10 p-3 text-[11px] text-vt-amber flex items-start gap-2 leading-relaxed">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                For faster action, <strong>long-press the specific message</strong> that broke the rules and report it directly — that attaches the exact evidence our moderators need. This {submitLabel} report will be reviewed even without a message, but may take longer.
              </span>
            </div>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reason</p>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all border ${
                  reason === r.id
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted/60'
                }`}
              >
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${reason === r.id ? 'border-primary bg-primary' : 'border-border'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.label}</span>
                  {r.hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{r.hint}</span>}
                </span>
              </button>
            ))}
          </div>

          {(reason === 'other' || comments) && (
            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Additional comments {reason === 'other' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Tell us more (optional)…"
                className="mt-1 w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground text-right">{comments.length} / 2000</p>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground leading-relaxed">
            Only the reported item is shared with VibTribe moderators for review. All your other chats stay protected by Trust Lock.
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 px-4 py-2.5 rounded-xl gradient-primary text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet
}