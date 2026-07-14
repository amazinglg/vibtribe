// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowLeft, ShieldAlert, Loader2, Search, Filter, RefreshCw, AlertTriangle,
  Ban, UserX, Trash2, CheckCircle2, XCircle, FileText, Download, Copy, Check, RotateCcw,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { moderateReport, getEvidenceSignedUrl } from '@/lib/reports.functions'

type ReportRow = {
  id: string
  reporter_id: string
  reporter_name: string | null
  reported_user_id: string | null
  reported_user_name: string | null
  report_type: string
  reason: string
  comments: string | null
  chat_id: string | null
  message_id: string | null
  status_id: string | null
  priority: number
  status: 'pending' | 'true_positive' | 'false_positive' | 'dismissed'
  moderator_id: string | null
  moderator_notes: string | null
  moderated_at: string | null
  action_taken: string | null
  snapshot: any
  created_at: string
}

const REASON_LABELS: Record<string, string> = {
  child_safety: 'Child Safety',
  nudity_sexual: 'Nudity / Sexual',
  harassment_bullying: 'Harassment',
  hate_speech: 'Hate Speech',
  violence: 'Violence',
  spam: 'Spam',
  scam_fraud: 'Scam / Fraud',
  fake_profile: 'Fake Profile',
  impersonation: 'Impersonation',
  terrorism: 'Terrorism',
  illegal_activity: 'Illegal',
  self_harm: 'Self-harm',
  privacy_violation: 'Privacy',
  copyright: 'Copyright',
  other: 'Other',
}

export default function AdminReportsPage() {
  const navigate = useNavigate()
  const { user, profile, loading, hasPermission } = useAuth()
  const canView = typeof hasPermission === 'function' && (hasPermission('reports.view') || hasPermission('reports.manage'))
  const canManage = typeof hasPermission === 'function' && hasPermission('reports.manage')
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [rows, setRows] = useState<ReportRow[]>([])
  const [busy, setBusy] = useState(true)
  const [query, setQuery] = useState('')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const moderate = useServerFn(moderateReport)
  const signUrl = useServerFn(getEvidenceSignedUrl)

  useEffect(() => {
    if (loading) return
    if (!user) { navigate({ to: '/sign-in', replace: true }); return }
    if (!canView) { navigate({ to: '/admin', replace: true }); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tab])

  // Realtime — refresh on any change
  useEffect(() => {
    if (!canView) return
    const ch = supabase
      .channel('admin-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_reports' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, tab])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      let q = supabase.from('content_reports').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false })
      if (tab === 'pending') q = q.eq('status', 'pending')
      else q = q.neq('status', 'pending')
      const { data, error } = await q.limit(200)
      if (error) throw error
      setRows((data as any) || [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load reports')
    } finally {
      setBusy(false)
    }
  }, [tab])

  const filtered = useMemo(() => {
    const qq = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false
      if (!qq) return true
      return (
        r.id.toLowerCase().includes(qq) ||
        (r.reporter_name || '').toLowerCase().includes(qq) ||
        (r.reported_user_name || '').toLowerCase().includes(qq) ||
        (r.reason || '').toLowerCase().includes(qq) ||
        (r.snapshot?.text || '').toString().toLowerCase().includes(qq)
      )
    })
  }, [rows, query, reasonFilter, typeFilter])

  async function handleDecision(r: ReportRow, status: 'true_positive' | 'false_positive' | 'dismissed', action: 'none' | 'suspend_user' | 'ban_user' | 'delete_content' | 'dismiss' = 'none') {
    setSavingId(r.id)
    try {
      await moderate({ data: { reportId: r.id, status, notes: notesById[r.id] || undefined, action } })
      toast.success('Decision saved')
      setOpenId(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Could not save decision')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDeleteReport(id: string) {
    try {
      const { error } = await supabase.rpc('admin_delete_report' as any, { _report_id: id })
      if (error) throw error
      toast.success('Report permanently deleted')
      setRows((rs) => rs.filter((r) => r.id !== id))
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete report')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate({ to: '/admin' })} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0 ring-1 ring-red-500/30">
              <ShieldAlert size={20} className="text-red-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xl text-foreground truncate">Reports</h1>
              <p className="text-xs text-muted-foreground truncate">Trust &amp; Safety moderation queue</p>
            </div>
          </div>
          <button onClick={load} className="ml-auto p-2 glass rounded-xl text-muted-foreground hover:text-foreground" title="Refresh">
            <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-4 w-fit">
          {(['pending', 'reviewed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'gradient-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'pending' ? 'Pending Review' : 'Reviewed'}
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reporter, reported user, id, reason…"
              className="w-full pl-9 pr-3 py-2 bg-input/60 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className="px-3 py-2 bg-input/60 border border-border rounded-xl text-sm">
            <option value="all">All reasons</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-input/60 border border-border rounded-xl text-sm">
            <option value="all">All types</option>
            {['message', 'image', 'video', 'file', 'audio', 'profile', 'chat', 'status'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {busy ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">
            {tab === 'pending' ? 'No reports awaiting review.' : 'No reviewed reports yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                expanded={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                notes={notesById[r.id] || ''}
                setNotes={(v) => setNotesById((p) => ({ ...p, [r.id]: v }))}
                onDecision={(status, action) => handleDecision(r, status, action)}
                onDelete={() => handleDeleteReport(r.id)}
                saving={savingId === r.id}
                signUrl={signUrl}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function ReportCard({
  report: r, expanded, onToggle, notes, setNotes, onDecision, onDelete, saving, signUrl, canManage,
}: {
  report: ReportRow
  expanded: boolean
  onToggle: () => void
  notes: string
  setNotes: (v: string) => void
  onDecision: (status: 'true_positive' | 'false_positive' | 'dismissed', action?: 'none' | 'suspend_user' | 'ban_user' | 'delete_content' | 'dismiss') => void
  onDelete: () => void
  saving: boolean
  signUrl: (input: any) => Promise<any>
  canManage: boolean
}) {
  const isPending = r.status === 'pending'
  const priority = r.priority >= 10
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [overriding, setOverriding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const media = r.snapshot?.media

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(r.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success('Report ID copied')
    } catch { toast.error('Could not copy') }
  }

  const wrappedDecision = (status: 'true_positive' | 'false_positive' | 'dismissed', action?: 'none' | 'suspend_user' | 'ban_user' | 'delete_content' | 'dismiss') => {
    setOverriding(false)
    onDecision(status, action)
  }

  useEffect(() => {
    if (!expanded || !media?.path) return
    let cancelled = false
    signUrl({ data: { path: media.path } })
      .then((res: any) => { if (!cancelled) setMediaUrl(res?.url || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [expanded, media?.path, signUrl])

  const decisionColor = {
    pending: 'bg-vt-amber/20 text-vt-amber',
    true_positive: 'bg-red-500/20 text-red-400',
    false_positive: 'bg-vt-green/20 text-vt-green',
    dismissed: 'bg-muted text-muted-foreground',
  }[r.status]

  return (
    <div className={`glass rounded-2xl border overflow-hidden ${priority && isPending ? 'border-red-500/60 ring-1 ring-red-500/30' : 'border-border'}`}>
      <button onClick={onToggle} className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${priority ? 'bg-red-500/20 text-red-400' : 'bg-primary/15 text-primary'}`}>
          {priority ? <AlertTriangle size={16} /> : <ShieldAlert size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">{r.report_type}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{REASON_LABELS[r.reason] || r.reason}</span>
            {priority && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">HIGH PRIORITY</span>}
            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${decisionColor}`}>{r.status.replace('_', ' ')}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
            #{r.id.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            <span className="text-foreground/80">{r.reporter_name || 'Reporter'}</span>
            {' → '}
            <span className="text-foreground/80">{r.reported_user_name || 'Reported user'}</span>
            {'  ·  '}{new Date(r.created_at).toLocaleString()}
          </p>
          {r.snapshot?.text && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.snapshot.text}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          <div className="space-y-3 text-[11px]">
            <div>
              <p className="text-muted-foreground uppercase mb-1">Report ID</p>
              <button
                onClick={copyId}
                title="Copy full ID"
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/60 border border-border text-foreground font-mono text-[11px] hover:bg-muted transition-colors max-w-full"
              >
                <span className="break-all text-left">{r.id}</span>
                {copied ? <Check size={12} className="text-vt-green flex-shrink-0" /> : <Copy size={12} className="text-muted-foreground flex-shrink-0" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-muted-foreground uppercase">Reason</p><p className="text-foreground">{REASON_LABELS[r.reason] || r.reason}</p></div>
              <div><p className="text-muted-foreground uppercase">Priority</p><p className="text-foreground">{priority ? 'High' : 'Normal'}</p></div>
            </div>
          </div>

          {r.comments && (
            <div>
              <p className="text-[11px] uppercase text-muted-foreground mb-1">Reporter comments</p>
              <p className="text-sm text-foreground bg-card/50 rounded-lg p-3 border border-border">{r.comments}</p>
            </div>
          )}

          {r.snapshot && (
            <div>
              <p className="text-[11px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><FileText size={12}/> Reported content snapshot</p>
              <div className="text-sm text-foreground bg-card/50 rounded-lg p-3 border border-border space-y-2">
                {r.snapshot?.text && <p className="whitespace-pre-wrap break-words">{r.snapshot.text}</p>}
                {r.snapshot?.profile && (
                  <div className="text-xs text-muted-foreground">
                    Profile — {r.snapshot.profile.full_name || '—'} {r.snapshot.profile.username ? `(@${r.snapshot.profile.username})` : ''}
                  </div>
                )}
                {r.snapshot?.chatMeta && (
                  <div className="text-xs text-muted-foreground">Chat — {r.snapshot.chatMeta.name || r.snapshot.chatMeta.id}</div>
                )}
                {media && (
                  <div className="mt-2">
                    {mediaUrl ? (
                      media.mime?.startsWith('image/') ? (
                        <img src={mediaUrl} alt="evidence" className="max-h-72 rounded-lg border border-border" />
                      ) : media.mime?.startsWith('video/') ? (
                        <video src={mediaUrl} controls className="max-h-72 rounded-lg border border-border" />
                      ) : media.mime?.startsWith('audio/') ? (
                        <audio src={mediaUrl} controls />
                      ) : (
                        <a href={mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs text-foreground">
                          <Download size={12} /> {media.name || 'evidence'}
                        </a>
                      )
                    ) : (
                      <div className="text-[11px] text-muted-foreground">Loading evidence…</div>
                    )}
                  </div>
                )}
                {!r.snapshot?.text && !r.snapshot?.profile && !r.snapshot?.chatMeta && !media && (
                  <p className="text-xs text-muted-foreground italic">No content snapshot was captured.</p>
                )}
              </div>
            </div>
          )}

          {canManage && (isPending || overriding) ? (
            <>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground">
                  Moderator notes {overriding && <span className="text-vt-amber normal-case">· Override previous decision</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
                  rows={2}
                  placeholder={overriding ? 'Why are you overriding the previous decision? (recommended)' : 'Add notes for the audit log (optional)…'}
                  className="mt-1 w-full px-3 py-2 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button disabled={saving} onClick={() => wrappedDecision('true_positive', 'none')} className="px-3 py-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-red-500/25 disabled:opacity-50">
                  <CheckCircle2 size={12} /> True Positive
                </button>
                <button disabled={saving} onClick={() => wrappedDecision('false_positive', 'none')} className="px-3 py-2 rounded-xl bg-vt-green/15 text-vt-green border border-vt-green/30 text-xs font-semibold flex items-center gap-1 hover:bg-vt-green/25 disabled:opacity-50">
                  <XCircle size={12} /> False Positive
                </button>
                <button disabled={saving || !r.reported_user_id} onClick={() => wrappedDecision('true_positive', 'suspend_user')} className="px-3 py-2 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-orange-500/25 disabled:opacity-50">
                  <UserX size={12} /> Suspend User
                </button>
                <button disabled={saving || !r.reported_user_id} onClick={() => wrappedDecision('true_positive', 'ban_user')} className="px-3 py-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-red-500/25 disabled:opacity-50">
                  <Ban size={12} /> Ban User
                </button>
                <button disabled={saving} onClick={() => wrappedDecision('true_positive', 'delete_content')} className="px-3 py-2 rounded-xl bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1 hover:bg-muted/70 disabled:opacity-50">
                  <Trash2 size={12} /> Mark Content Deleted
                </button>
                <button disabled={saving} onClick={() => wrappedDecision('dismissed', 'dismiss')} className="ml-auto px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground disabled:opacity-50">
                  Dismiss
                </button>
              </div>
              {overriding && (
                <button
                  onClick={() => setOverriding(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Cancel override
                </button>
              )}
            </>
          ) : (
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p>Decision: <span className="text-foreground font-semibold capitalize">{r.status.replace('_', ' ')}</span> {r.action_taken && r.action_taken !== 'none' && <>· action: <span className="text-foreground">{r.action_taken.replace('_', ' ')}</span></>}</p>
              <p>Reviewed at: {r.moderated_at ? new Date(r.moderated_at).toLocaleString() : '—'}</p>
              {r.moderator_notes && <p className="mt-2 whitespace-pre-wrap">Notes: {r.moderator_notes}</p>}
              {canManage && <div className="pt-3">
                <button
                  onClick={() => setOverriding(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-vt-amber/15 text-vt-amber border border-vt-amber/30 text-xs font-semibold hover:bg-vt-amber/25 transition-colors"
                >
                  <RotateCcw size={12} /> Change / Override decision
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold hover:bg-red-500/25 transition-colors"
                >
                  <Trash2 size={12} /> Delete permanently
                </button>
                <p className="text-[10px] text-muted-foreground mt-1.5">A new audit-log entry will be recorded.</p>
              </div>}
            </div>
          )}
        </div>
      )}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirmDel(false)}>
          <div className="glass-strong rounded-2xl border border-border p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground mb-2">Permanently delete this report?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              The report, its appeals, and its audit trail will be removed from the database entirely. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancel</button>
              <button
                onClick={() => { setConfirmDel(false); onDelete() }}
                className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}