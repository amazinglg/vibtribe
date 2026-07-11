// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Crown, Loader2, Search, X, Infinity as InfinityIcon, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export default function AdminPremiumUsersPage() {
  const navigate = useNavigate()
  const { user, profile, loading, hasPermission } = useAuth()
  const canView = typeof hasPermission === 'function' && (hasPermission('premium.view') || hasPermission('premium.manage'))
  const [rows, setRows] = useState<any[]>([])
  const [busy, setBusy] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) { navigate({ to: '/sign-in', replace: true }); return }
    if (!canView) { navigate({ to: '/admin', replace: true }); return }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function refresh() {
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('admin_list_premium_users' as any)
      if (error) throw error
      setRows(data || [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load premium users')
    } finally {
      setBusy(false)
    }
  }

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q) ||
      (r.real_email || '').toLowerCase().includes(q) ||
      (r.mobile_number || '').toLowerCase().includes(q)
    )
  })

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate({ to: '/admin' })} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/30 via-yellow-500/20 to-orange-500/20 flex items-center justify-center shrink-0 ring-1 ring-white/10">
              <Crown size={20} className="text-amber-300" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xl text-foreground truncate">Premium Users</h1>
              <p className="text-xs text-muted-foreground truncate">
                {rows.length} active premium {rows.length === 1 ? 'subscriber' : 'subscribers'}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, email or mobile…"
            className="w-full pl-9 pr-9 py-2.5 bg-input/60 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>

        {busy ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'No premium users yet.' : `No users match "${query}".`}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const forever = !r.premium_expires_at
              const expired = !forever && new Date(r.premium_expires_at).getTime() < Date.now()
              const daysLeft = forever ? null : Math.max(0, Math.ceil((new Date(r.premium_expires_at).getTime() - Date.now()) / 86400000))
              return (
                <button
                  key={r.id}
                  onClick={() => navigate({ to: '/admin/user/$userId', params: { userId: r.id } })}
                  className="w-full text-left glass rounded-2xl border border-border p-3 flex items-center gap-3 hover:border-amber-400/40 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/30 flex items-center justify-center text-white font-bold shrink-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (r.full_name || '?')[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{r.full_name || 'Unknown'}</p>
                      <Crown size={12} className="text-amber-400 shrink-0" />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.username ? `@${r.username} · ` : ''}{r.real_email || r.mobile_number || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {forever ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 font-semibold">
                        <InfinityIcon size={11} /> Forever
                      </span>
                    ) : expired ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-red-500/15 text-red-300 font-semibold">Expired</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold">
                        <Clock size={11} /> {daysLeft}d left
                      </span>
                    )}
                    {!forever && r.premium_expires_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        until {new Date(r.premium_expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}