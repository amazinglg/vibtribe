// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ShieldQuestion, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

type Row = {
  id: string
  block_id: string | null
  original_user_id: string | null
  appellant_email: string | null
  appellant_name: string | null
  reason: string | null
  status: 'awaiting_submission' | 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  reviewed_at: string | null
  submitted_at: string | null
  created_at: string
}

export default function AdminOffboardingAppealsPage() {
  const navigate = useNavigate()
  const { loading, isAdmin } = useAuth()
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setBusy(true)
    const q = supabase
      .from('offboarding_appeals' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    const { data, error } = tab === 'pending'
      ? await q.eq('status', 'pending')
      : await q.in('status', ['approved', 'rejected'])
    if (error) toast.error(error.message)
    setRows((data as any) || [])
    setBusy(false)
  }, [tab])

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: '/admin' })
  }, [loading, isAdmin, navigate])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    try {
      const { error } = await supabase.rpc('admin_review_offboarding_appeal' as any, {
        _appeal_id: id,
        _decision: decision,
        _notes: notes[id] || null,
      })
      if (error) throw error
      toast.success(
        decision === 'approved'
          ? 'Appeal approved — user unblocked'
          : 'Appeal rejected — block remains',
      )
      setNotes((n) => ({ ...n, [id]: '' }))
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record decision')
    }
  }

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows])

  if (loading || !isAdmin) return null

  return (
    <AppLayout>
      <div className="min-h-screen gradient-bg-profile pb-20 lg:pb-0">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate({ to: '/admin' })} className="p-2 rounded-lg hover:bg-muted">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <ShieldQuestion className="text-primary" size={22} />
              <h1 className="text-xl font-bold">Offboarding appeals</h1>
            </div>
            <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-muted" title="Refresh">
              <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex gap-2">
            {(['pending', 'reviewed'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-full text-sm capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'glass'}`}
              >
                {t}
                {t === 'pending' && pendingCount > 0 && tab !== 'pending' ? (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">{pendingCount}</span>
                ) : null}
              </button>
            ))}
          </div>

          {busy && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No appeals in this tab.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="glass rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-semibold truncate">
                      {r.appellant_name || '(unnamed)'} · <span className="text-muted-foreground font-normal">{r.appellant_email || '—'}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        r.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : r.status === 'approved'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Offboarded for <span className="font-medium text-foreground">terms breach</span> · Appeal submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                  </p>
                  <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap">
                    <span className="text-muted-foreground">User&apos;s appeal:</span> {r.reason || '(no reason provided)'}
                  </p>

                  {r.status === 'pending' ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        placeholder="Optional notes shown on the user's appeal page"
                        value={notes[r.id] || ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        rows={2}
                        className="w-full text-sm rounded-lg bg-background/40 border border-border p-2"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => decide(r.id, 'approved')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm">
                          <CheckCircle2 size={16} /> Approve · Unblock user
                        </button>
                        <button onClick={() => decide(r.id, 'rejected')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm">
                          <XCircle size={16} /> Reject · Keep blocked
                        </button>
                      </div>
                    </div>
                  ) : (
                    r.reviewer_notes && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="text-foreground/70">Reviewer notes:</span> {r.reviewer_notes}
                      </p>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}