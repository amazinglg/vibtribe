import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Radio, Copy, ShieldOff, ShieldCheck, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useServerFn } from '@tanstack/react-start'
import AppLayout from '@/components/AppLayout'
import { listGateways, provisionGateway, setGatewayStatus, type GatewayRow } from '@/lib/gateway-admin.functions'

type Provisioned = { device_id: string; device_secret: string; signing_key: string; label: string }

export default function AdminGatewaysPage() {
  const list = useServerFn(listGateways)
  const provision = useServerFn(provisionGateway)
  const setStatus = useServerFn(setGatewayStatus)

  const [rows, setRows] = useState<GatewayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<Provisioned | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await list({ data: undefined as never }))
    } catch (e: any) {
      toast.error(e?.message === 'Forbidden' ? 'Master admin only' : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [list])

  useEffect(() => { void load() }, [load])

  const copy = (v: string, what: string) => {
    void navigator.clipboard.writeText(v)
    toast.success(`${what} copied`)
  }

  const onProvision = async () => {
    if (!label.trim()) { toast.error('Enter a device label'); return }
    setBusy(true)
    try {
      const res = await provision({ data: { label: label.trim() } })
      setFresh(res)
      setLabel('')
      await load()
    } catch (e: any) {
      toast.error(e?.message === 'Forbidden' ? 'Master admin only' : 'Provisioning failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => window.history.back()} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-vt-amber/20 rounded-2xl flex items-center justify-center">
              <Radio size={20} className="text-vt-amber" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">SMS Gateway Devices</h1>
              <p className="text-xs text-muted-foreground">Provision and manage Auth Hub devices</p>
            </div>
          </div>
          <button onClick={() => void load()} className="ml-auto p-2 glass rounded-xl text-muted-foreground hover:text-foreground transition-all" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* One-time secret reveal */}
        {fresh && (
          <div className="glass rounded-2xl border border-vt-amber/40 p-4 mb-6 space-y-3">
            <p className="text-sm font-semibold text-foreground">Device provisioned — copy the secret now</p>
            <p className="text-xs text-muted-foreground">This secret is shown once and cannot be retrieved again. Only its hash is stored.</p>
            {([
              ['Device ID', fresh.device_id],
              ['Device Secret', fresh.device_secret],
              ['HMAC signing key (SHA-256 of secret)', fresh.signing_key],
            ] as const).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs break-all bg-muted rounded-lg px-2 py-1.5 text-foreground">{v}</code>
                  <button onClick={() => copy(v, k)} className="p-2 glass rounded-lg text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
                </div>
              </div>
            ))}
            <button onClick={() => setFresh(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">I've saved it — hide</button>
          </div>
        )}

        {/* Provision */}
        <div className="glass rounded-2xl border border-border p-4 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">Provision a new device</p>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Auth Hub — office phone)"
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground outline-none"
            />
            <button
              onClick={() => void onProvision()}
              disabled={busy}
              className="gradient-primary text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus size={15} /> Provision
            </button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">No devices provisioned yet.</p>}
          {rows.map((g) => (
            <div key={g.device_id} className="glass rounded-xl border border-border p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{g.label || 'Unlabelled device'}</p>
                <code className="text-[11px] text-muted-foreground break-all">{g.device_id}</code>
                <p className="text-[11px] text-muted-foreground">
                  Last seen: {g.last_seen_at ? new Date(g.last_seen_at).toLocaleString() : 'never'}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${g.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/15 text-red-500 border border-red-500/30'}`}>
                {g.status}
              </span>
              <button
                onClick={async () => {
                  try {
                    await setStatus({ data: { deviceId: g.device_id, status: g.status === 'active' ? 'revoked' : 'active' } })
                    await load()
                  } catch { toast.error('Update failed') }
                }}
                className="p-2 glass rounded-lg text-muted-foreground hover:text-foreground"
                title={g.status === 'active' ? 'Revoke' : 'Re-activate'}
              >
                {g.status === 'active' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
