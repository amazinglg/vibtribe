// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { ArrowLeft, Shield, Plus, Trash2, Loader2, Lock, X } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import {
  listPermissionsMatrix, setRoleGroupPermission, createRole, deleteRole,
} from '@/lib/permissions.functions'

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

  useEffect(() => {
    if (loading) return
    if (!user) { router({ to: '/sign-in', replace: true }); return }
    if (!isMaster && profile?.role !== 'admin') { router({ to: '/admin', replace: true }); return }
    refresh()
  }, [user, loading, profile])

  async function refresh() {
    setLoadingData(true)
    try {
      const r = await listFn()
      setRoles(r.roles)
      setKeys(r.keys)
      const map: Record<string, boolean> = {}
      for (const a of r.assignments) map[`${a.role_key}::${a.permission_key}`] = a.allowed
      setAssignments(map)
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
    if (role.is_system) { toast.error('System roles cannot be deleted'); return }
    if (!confirm(`Delete role "${role.label}"? This removes all its permission assignments.`)) return
    try {
      await deleteFn({ data: { key: role.key } })
      toast.success('Role deleted'); refresh()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  // Group keys by category, split into view vs write
  const grouped: Record<string, { view: any[]; write: any[] }> = {}
  for (const k of keys) {
    const g = (grouped[k.category] ||= { view: [], write: [] })
    if (k.key.endsWith('.view')) g.view.push(k)
    else g.write.push(k)
  }

  if (loading || loadingData) {
    return <AppLayout><div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router({ to: '/admin' })} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">Permissions</h1>
              <p className="text-xs text-muted-foreground">
                {isMaster ? 'Master admin — full edit access' : 'Read-only · only master admin can change permissions'}
              </p>
            </div>
          </div>
          {isMaster && (
            <button onClick={() => setShowAdd(true)} className="ml-auto gradient-primary text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 glow-primary">
              <Plus size={14} /> Add Role
            </button>
          )}
        </div>

        <div className="glass rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-muted/40 z-10 min-w-[200px]">Section</th>
                  {roles.map(r => (
                    <th key={r.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap min-w-[160px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{r.label}</span>
                        {r.is_system ? (
                          <Lock size={10} className="text-muted-foreground" />
                        ) : isMaster ? (
                          <button onClick={() => handleDeleteRole(r)} className="text-muted-foreground hover:text-red-400">
                            <Trash2 size={11} />
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([cat, groups]) => {
                  const writeKeys: string[] = groups.write.map(k => k.key)
                  const viewKeys: string[] = groups.view.map(k => k.key)
                  return (
                    <tr key={cat} className="border-t border-border/30 hover:bg-muted/20">
                      <td className="px-4 py-4 sticky left-0 bg-background/95 backdrop-blur z-10">
                        <div className="font-semibold text-foreground">{cat}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {viewKeys.length} view · {writeKeys.length} write
                        </div>
                      </td>
                      {roles.map(r => {
                        const viewAllowed = viewKeys.length > 0 && viewKeys.every(k => assignments[`${r.key}::${k}`])
                        const writeAllowed = writeKeys.length > 0 && writeKeys.every(k => assignments[`${r.key}::${k}`])
                        const viewBusy = busy === `${r.key}::__view::${cat}`
                        const writeBusy = busy === `${r.key}::__write::${cat}`
                        return (
                          <td key={r.key} className="px-3 py-3">
                            <div className="flex flex-col items-center gap-2">
                              <ToggleWithLabel
                                label="View"
                                allowed={viewAllowed}
                                disabled={!isMaster || viewKeys.length === 0 || viewBusy}
                                onClick={() => toggleGroup(r.key, `__view::${cat}`, viewKeys, !viewAllowed)}
                              />
                              <ToggleWithLabel
                                label="Write"
                                allowed={writeAllowed}
                                disabled={!isMaster || writeKeys.length === 0 || writeBusy}
                                onClick={() => toggleGroup(r.key, `__write::${cat}`, writeKeys, !writeAllowed)}
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
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

function ToggleWithLabel({ label, allowed, disabled, onClick }: { label: string; allowed: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`relative w-10 h-6 rounded-full transition-all ${allowed ? 'bg-vt-green' : 'bg-muted'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'}`}
        aria-label={`${allowed ? 'Disable' : 'Enable'} ${label}`}
      >
        <span className={`absolute top-0.5 ${allowed ? 'right-0.5' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all`} />
      </button>
      <span className="text-xs text-muted-foreground w-10 text-left">{label}</span>
    </div>
  )
}