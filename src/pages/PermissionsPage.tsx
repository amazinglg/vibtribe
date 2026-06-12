// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import {
  ArrowLeft, Shield, Plus, Trash2, Loader2, Lock, X, Search,
  ChevronDown, Check, Minus, Eye, Pencil, Users, MessageSquare,
  Megaphone, Bell, HardDrive, FileText, BarChart3, Settings,
  Package, ShieldCheck, Mail, Tag,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import {
  listPermissionsMatrix, setRoleGroupPermission, createRole, deleteRole,
} from '@/lib/permissions.functions'

const CATEGORY_META: Record<string, { icon: any; tint: string }> = {
  Users: { icon: Users, tint: 'from-blue-500/20 to-cyan-500/10 text-blue-400' },
  Chats: { icon: MessageSquare, tint: 'from-violet-500/20 to-fuchsia-500/10 text-violet-300' },
  Messages: { icon: MessageSquare, tint: 'from-violet-500/20 to-fuchsia-500/10 text-violet-300' },
  Broadcasts: { icon: Megaphone, tint: 'from-pink-500/20 to-rose-500/10 text-pink-300' },
  Marketing: { icon: Megaphone, tint: 'from-pink-500/20 to-rose-500/10 text-pink-300' },
  Notifications: { icon: Bell, tint: 'from-amber-500/20 to-orange-500/10 text-amber-300' },
  Storage: { icon: HardDrive, tint: 'from-emerald-500/20 to-teal-500/10 text-emerald-300' },
  Support: { icon: Mail, tint: 'from-sky-500/20 to-indigo-500/10 text-sky-300' },
  Tickets: { icon: Mail, tint: 'from-sky-500/20 to-indigo-500/10 text-sky-300' },
  Releases: { icon: Package, tint: 'from-purple-500/20 to-indigo-500/10 text-purple-300' },
  Roles: { icon: ShieldCheck, tint: 'from-red-500/20 to-orange-500/10 text-red-300' },
  Analytics: { icon: BarChart3, tint: 'from-lime-500/20 to-green-500/10 text-lime-300' },
  'Audit Logs': { icon: FileText, tint: 'from-zinc-500/20 to-slate-500/10 text-zinc-300' },
  Settings: { icon: Settings, tint: 'from-cyan-500/20 to-blue-500/10 text-cyan-300' },
}

function metaFor(cat: string) {
  return CATEGORY_META[cat] || { icon: Tag, tint: 'from-muted to-muted/30 text-muted-foreground' }
}

export default function PermissionsPage() {
  const router = useNavigate()
  const { user, profile, loading } = useAuth()
  const isMaster = !!profile?.is_master_admin

  const listFn = useServerFn(listPermissionsMatrix)
  const setGroupFn = useServerFn(setRoleGroupPermission)
  const createFn = useServerFn(createRole)
  const deleteFn = useServerFn(deleteRole)

  const [roles, setRoles] = useState<any[]>([])
  const [keys, setKeys] = useState<any[]>([])
  const [assignments, setAssignments] = useState<Record<string, boolean>>({})
  const [loadingData, setLoadingData] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newRole, setNewRole] = useState({ key: '', label: '', description: '' })
  const [query, setQuery] = useState('')
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (loading) return
    if (!user) { router({ to: '/sign-in', replace: true }); return }
    if (!isMaster && profile?.role !== 'admin') { router({ to: '/admin', replace: true }); return }
    refresh()
    // Only load the matrix once on mount. Subsequent profile updates from
    // the AuthContext (presence heartbeats, token refresh, etc.) must NOT
    // silently re-fetch and overwrite in-flight master-admin edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function refresh() {
    setLoadingData(true)
    try {
      const r = await listFn()
      setRoles(r.roles)
      setKeys(r.keys)
      const map: Record<string, boolean> = {}
      for (const a of r.assignments) map[`${a.role_key}::${a.permission_key}`] = a.allowed
      setAssignments(map)
      if (!activeRole && r.roles?.length) {
        const first = r.roles.find((x: any) => x.key !== 'master_admin') || r.roles[0]
        setActiveRole(first?.key || null)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load')
    } finally { setLoadingData(false) }
  }

  async function toggleGroup(roleKey: string, groupId: string, permKeys: string[], next: boolean) {
    if (!isMaster || permKeys.length === 0) return
    const cell = `${roleKey}::${groupId}`
    setBusy(cell)
    const prev: Record<string, boolean> = {}
    for (const k of permKeys) prev[k] = assignments[`${roleKey}::${k}`] ?? false
    setAssignments(a => {
      const copy = { ...a }
      for (const k of permKeys) copy[`${roleKey}::${k}`] = next
      return copy
    })
    try {
      await setGroupFn({ data: { roleKey, permissionKeys: permKeys, allowed: next } })
    } catch (e: any) {
      setAssignments(a => {
        const copy = { ...a }
        for (const k of permKeys) copy[`${roleKey}::${k}`] = prev[k]
        return copy
      })
      toast.error(e?.message || 'Update failed')
    } finally { setBusy(null) }
  }

  async function handleAddRole() {
    if (!newRole.key.trim() || !newRole.label.trim()) { toast.error('Key and label required'); return }
    try {
      await createFn({ data: { key: newRole.key.trim(), label: newRole.label.trim(), description: newRole.description.trim() || null } })
      toast.success('Role created')
      setShowAdd(false); setNewRole({ key: '', label: '', description: '' })
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Create failed') }
  }

  async function handleDeleteRole(role: any) {
    if (role.key === 'master_admin') { toast.error('The master admin role cannot be deleted'); return }
    const warning =
      `Delete role "${role.label}"?\n\n` +
      `This will permanently remove the role, revoke all of its permission ` +
      `assignments, and any users currently holding this role will be reverted ` +
      `to the default "user" role. This action cannot be undone.`
    if (!confirm(warning)) return
    try {
      await deleteFn({ data: { key: role.key } })
      if (activeRole === role.key) setActiveRole(null)
      toast.success('Role deleted'); refresh()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  // Group keys by category, split into view vs write
  const grouped = useMemo(() => {
    const g: Record<string, { view: any[]; write: any[]; all: any[] }> = {}
    for (const k of keys) {
      const bucket = (g[k.category] ||= { view: [], write: [], all: [] })
      bucket.all.push(k)
      if (k.key.endsWith('.view')) bucket.view.push(k)
      else bucket.write.push(k)
    }
    return g
  }, [keys])

  const filteredCats = useMemo(() => {
    const q = query.trim().toLowerCase()
    const entries = Object.entries(grouped)
    if (!q) return entries
    return entries.filter(([cat, gr]) =>
      cat.toLowerCase().includes(q) ||
      gr.all.some(k => (k.label || k.key).toLowerCase().includes(q) || (k.key || '').toLowerCase().includes(q))
    )
  }, [grouped, query])

  const activeRoleObj = roles.find(r => r.key === activeRole)

  function countsFor(roleKey: string) {
    let on = 0
    for (const k of keys) if (assignments[`${roleKey}::${k.key}`]) on++
    return { on, total: keys.length }
  }

  if (loading || loadingData) {
    return <AppLayout><div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router({ to: '/admin' })} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-pink-500/20 flex items-center justify-center shrink-0 ring-1 ring-white/10">
              <Shield size={20} className="text-fuchsia-300" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xl text-foreground truncate">Permissions</h1>
              <p className="text-xs text-muted-foreground truncate">
                {isMaster ? 'Master admin · pick a role to edit its access' : 'Read-only · only master admin can change permissions'}
              </p>
            </div>
          </div>
          {isMaster && (
            <button onClick={() => setShowAdd(true)} className="gradient-primary text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 glow-primary shrink-0">
              <Plus size={14} /> <span className="hidden sm:inline">Add Role</span>
            </button>
          )}
        </div>

        {/* Role chips (pinned) + search */}
        <div className="sticky top-0 z-30 -mx-4 px-4 lg:mx-0 lg:px-0 pt-2 pb-3 mb-4 backdrop-blur-xl bg-background/70 border-b border-border/40">
          <div className="flex gap-2 overflow-x-auto pb-2 -mb-0.5 scrollbar-none">
            {roles.map(r => {
              const active = r.key === activeRole
              const c = countsFor(r.key)
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveRole(r.key)}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-2xl text-sm whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-pink-500/20 border-fuchsia-400/40 text-white shadow-[0_4px_20px_-6px_rgba(217,70,239,0.4)]'
                      : 'glass border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldCheck size={13} className={active ? 'text-fuchsia-200' : ''} />
                  <span className="font-semibold">{r.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {c.on}/{c.total}
                  </span>
                  {r.is_system && <Lock size={10} className="opacity-60" />}
                </button>
              )
            })}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search section or permission…"
              className="w-full pl-9 pr-9 py-2.5 bg-input/60 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Active role summary */}
        {activeRoleObj && (
          <div className="glass rounded-2xl border border-border p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 flex items-center justify-center ring-1 ring-white/10">
              <ShieldCheck size={18} className="text-fuchsia-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-foreground truncate">{activeRoleObj.label}</h2>
                {activeRoleObj.is_system && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                    <Lock size={9} /> System
                  </span>
                )}
              </div>
              {activeRoleObj.description && (
                <p className="text-xs text-muted-foreground truncate">{activeRoleObj.description}</p>
              )}
            </div>
            {isMaster && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => toggleGroup(activeRoleObj.key, '__all__', keys.map(k => k.key), true)}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 font-semibold"
                >Allow all</button>
                <button
                  onClick={() => toggleGroup(activeRoleObj.key, '__all__', keys.map(k => k.key), false)}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground font-semibold"
                >Clear</button>
              </div>
            )}
          </div>
        )}

        {/* Category cards */}
        {!activeRoleObj ? (
          <div className="glass rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">
            Select a role above to manage its permissions.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCats.length === 0 && (
              <div className="glass rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
                No permissions match "{query}".
              </div>
            )}
            {filteredCats.map(([cat, groups]) => {
              const meta = metaFor(cat)
              const Icon = meta.icon
              const viewKeys: string[] = groups.view.map(k => k.key)
              const writeKeys: string[] = groups.write.map(k => k.key)
              const allKeys: string[] = groups.all.map(k => k.key)
              const r = activeRoleObj
              const onCount = allKeys.filter(k => assignments[`${r.key}::${k}`]).length
              const allOn = onCount === allKeys.length
              const someOn = onCount > 0 && !allOn
              const isOpen = !!expanded[cat] || !!query
              const viewAllowed = viewKeys.length > 0 && viewKeys.every(k => assignments[`${r.key}::${k}`])
              const writeAllowed = writeKeys.length > 0 && writeKeys.every(k => assignments[`${r.key}::${k}`])

              return (
                <div key={cat} className="glass rounded-2xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 p-3 sm:p-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.tint} flex items-center justify-center ring-1 ring-white/5 shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <button
                      onClick={() => setExpanded(s => ({ ...s, [cat]: !s[cat] }))}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          allOn ? 'bg-emerald-500/20 text-emerald-300'
                            : someOn ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {onCount}/{allKeys.length}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {viewKeys.length} view · {writeKeys.length} write
                      </div>
                    </button>

                    {/* Quick toggles */}
                    <div className="hidden sm:flex items-center gap-2">
                      <QuickToggle
                        icon={<Eye size={12} />}
                        label="View"
                        active={viewAllowed}
                        disabled={!isMaster || viewKeys.length === 0}
                        onClick={() => toggleGroup(r.key, `__view::${cat}`, viewKeys, !viewAllowed)}
                      />
                      <QuickToggle
                        icon={<Pencil size={12} />}
                        label="Write"
                        active={writeAllowed}
                        disabled={!isMaster || writeKeys.length === 0}
                        onClick={() => toggleGroup(r.key, `__write::${cat}`, writeKeys, !writeAllowed)}
                      />
                    </div>
                    <button
                      onClick={() => setExpanded(s => ({ ...s, [cat]: !s[cat] }))}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Mobile quick toggles */}
                  <div className="sm:hidden flex items-center gap-2 px-4 pb-3 -mt-1">
                    <QuickToggle
                      icon={<Eye size={12} />}
                      label="View"
                      active={viewAllowed}
                      disabled={!isMaster || viewKeys.length === 0}
                      onClick={() => toggleGroup(r.key, `__view::${cat}`, viewKeys, !viewAllowed)}
                    />
                    <QuickToggle
                      icon={<Pencil size={12} />}
                      label="Write"
                      active={writeAllowed}
                      disabled={!isMaster || writeKeys.length === 0}
                      onClick={() => toggleGroup(r.key, `__write::${cat}`, writeKeys, !writeAllowed)}
                    />
                  </div>

                  {isOpen && (
                    <div className="border-t border-border/40 divide-y divide-border/30">
                      {groups.all.map(k => {
                        const on = !!assignments[`${r.key}::${k.key}`]
                        const isView = k.key.endsWith('.view')
                        return (
                          <div key={k.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isView ? 'bg-sky-500/10 text-sky-300' : 'bg-fuchsia-500/10 text-fuchsia-300'
                            }`}>
                              {isView ? <Eye size={12} /> : <Pencil size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate">{k.label || k.key}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{k.key}</div>
                            </div>
                            <Toggle
                              allowed={on}
                              disabled={!isMaster || busy?.startsWith(`${r.key}::__`)}
                              onClick={() => toggleGroup(r.key, k.key, [k.key], !on)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Master Admin role has all permissions and is not listed. The pinned master account cannot be demoted.
        </p>

        {showAdd && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <div className="glass-strong rounded-2xl border border-border p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Add Role</h3>
                <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Key (lowercase, no spaces)</span>
                  <input value={newRole.key} onChange={e => setNewRole(r => ({ ...r, key: e.target.value.toLowerCase() }))}
                    placeholder="e.g. content_editor" className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-lg text-sm font-mono" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Display label</span>
                  <input value={newRole.label} onChange={e => setNewRole(r => ({ ...r, label: e.target.value }))}
                    placeholder="e.g. Content Editor" className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-lg text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Description (optional)</span>
                  <input value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-lg text-sm" />
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-semibold">Cancel</button>
                <button onClick={handleAddRole} className="flex-1 gradient-primary text-white rounded-xl text-sm font-semibold py-2 glow-primary">Create Role</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Toggle({ allowed, disabled, onClick }: { allowed: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative w-10 h-6 rounded-full transition-all shrink-0 ${
        allowed ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_10px_-2px_rgba(16,185,129,0.6)]' : 'bg-muted'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-90'}`}
      aria-label={allowed ? 'Disable' : 'Enable'}
    >
      <span className={`absolute top-0.5 ${allowed ? 'right-0.5' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all`} />
    </button>
  )
}

function QuickToggle({ icon, label, active, disabled, onClick }: { icon: React.ReactNode; label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
        active
          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon}
      <span>{label}</span>
      {active ? <Check size={11} /> : <Minus size={11} />}
    </button>
  )
}