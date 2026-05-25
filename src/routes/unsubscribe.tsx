import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({ component: UnsubscribePage })

function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'used' | 'error'>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    setToken(t)
    if (!t) { setStatus('error'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.used) setStatus('used')
        else if (d?.email) { setEmail(d.email); setStatus('ready') }
        else setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [])

  const confirm = async () => {
    const r = await fetch('/email/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setStatus(r.ok ? 'done' : 'error')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full glass-strong rounded-3xl border border-border p-8 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-3">Unsubscribe from VibTribe emails</h1>
        {status === 'loading' && <p className="text-muted-foreground text-sm">Checking your link…</p>}
        {status === 'ready' && (
          <>
            <p className="text-muted-foreground text-sm mb-6">
              You're about to unsubscribe <strong>{email}</strong> from app emails. Auth emails (password resets, verification codes) will still be sent.
            </p>
            <button onClick={confirm} className="gradient-primary text-white font-semibold py-3 px-6 rounded-xl">
              Confirm Unsubscribe
            </button>
          </>
        )}
        {status === 'done' && <p className="text-foreground">You've been unsubscribed. Sorry to see you go.</p>}
        {status === 'used' && <p className="text-muted-foreground text-sm">You're already unsubscribed.</p>}
        {status === 'error' && <p className="text-red-400 text-sm">This unsubscribe link is invalid or expired.</p>}
      </div>
    </div>
  )
}