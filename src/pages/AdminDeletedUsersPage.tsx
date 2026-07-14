// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, UserX, RefreshCw, Loader2, Search, Trash2 } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

type Row = {
  id: string
  original_user_id: string
  full_name: string | null
  email: string | null
  mobile_number: string | null
  country_code: string | null
  initiated_by: 'user' | 'admin'
  initiator_id: string | null
  reason_key: string
  reason_text: string | null
  terms_breach: boolean
  deleted_at: string
}

export default function AdminDeletedUsersPage() {
  const navigate = useNavigate()
  const { loading, profile, isAdmin } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    const { data, error } = await supabase
      .from('deleted_users_log' as any)
      .select('*')
      .order('deleted_at', { ascending: false })
      .limit(500)
    if (error) toast.error(error.message)
    setRows((data as any) || [])
    setBusy(false)
  }, [])

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: '/admin' })
  }, [loading, isAdmin, navigate])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const { error } = await supabase.rpc('admin_delete_deleted_user_log' as any, { _id: id })
      if (error) throw error
      toast.success('Entry permanently deleted')
      setRows((rs) => rs.filter((r) => r.id !== id))
      setConfirmId(null)
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete entry')
    }
    setDeleting(null)
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((r) =>
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.mobile_number || '').includes(q) ||
      (r.reason_key || '').toLowerCase().includes(q),
    )
  }, [rows, query])

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
              <UserX className="text-red-400" size={22} />
              <h1 className="text-xl font-bold">Deleted users</h1>
              <span className="text-xs text-muted-foreground ml-1">({rows.length})</span>
            </div>
            <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-muted" title="Refresh">
              <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, phone, or reason…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background/40 border border-border text-sm"
            />
          </div>

          {busy && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No records match.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div key={r.id} className="glass rounded-2xl p-4 border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{r.full_name || '(unnamed)'}</p>
                        <span
                          className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${
                            r.initiated_by === 'admin'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {r.initiated_by === 'admin' ? 'Admin removed' : 'User self-deleted'}
                        </span>
                        {r.terms_breach && (
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                            Terms breach · Blocked
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>{r.email || '—'}</p>
                        <p>{r.mobile_number || '—'} {r.country_code ? `(${r.country_code})` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {new Date(r.deleted_at).toLocaleString()}
                      <button
                        onClick={() => setConfirmId(r.id)}
                        title="Permanently delete this entry"
                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 text-[11px]"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">Reason: </span>
                    <span className="font-medium text-foreground">{r.reason_key}</span>
                    {r.reason_text && (
                      <p className="text-muted-foreground italic mt-1">“{r.reason_text}”</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {confirmId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !deleting && setConfirmId(null)}>
              <div className="glass-strong rounded-2xl border border-border p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-foreground mb-2">Permanently delete this entry?</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  This removes the audit record from the database entirely. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmId(null)} disabled={!!deleting} className="flex-1 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50">Cancel</button>
                  <button onClick={() => handleDelete(confirmId)} disabled={!!deleting} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {deleting && <Loader2 size={14} className="animate-spin" />} Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}