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

  const openInAppNotifications = () => {
    // Same-origin deep-link to in-app notification preferences. Works in
    // both the installed PWA and the website.
    window.location.href = '/profile-screen?tab=notifications'
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
            <div className="flex flex-col gap-3">
              <button onClick={confirm} className="gradient-primary text-white font-semibold py-3 px-6 rounded-xl">
                Confirm Unsubscribe
              </button>
              <button onClick={openInAppNotifications} className="text-sm text-primary hover:underline">
                Or manage all notification preferences in the app →
              </button>
            </div>
          </>
        )}
        {status === 'done' && (
          <>
            <p className="text-foreground mb-4">You've been unsubscribed. Sorry to see you go.</p>
            <button onClick={openInAppNotifications} className="gradient-primary text-white font-semibold py-3 px-6 rounded-xl">
              Manage notification settings
            </button>
          </>
        )}
        {status === 'used' && (
          <>
            <p className="text-muted-foreground text-sm mb-4">You're already unsubscribed.</p>
            <button onClick={openInAppNotifications} className="gradient-primary text-white font-semibold py-3 px-6 rounded-xl">
              Manage notification settings
            </button>
          </>
        )}
        {status === 'error' && <p className="text-red-400 text-sm">This unsubscribe link is invalid or expired.</p>}
      </div>
    </div>
  )
}