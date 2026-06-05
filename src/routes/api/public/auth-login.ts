import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Public login route. Wraps the previously client-exposed RPCs
// (pre_login_lookup, record_login_failure, record_login_success) so
// they cannot be abused independently to suspend arbitrary accounts.
// The failure counter only increments after a real password attempt
// has been verified against Supabase Auth.

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

function getAnonClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const BodySchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
})

export const Route = createFileRoute('/api/public/auth-login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed
        try {
          parsed = BodySchema.parse(await request.json())
        } catch {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }
        const { identifier, password } = parsed

        const admin = getAdminClient()

        // 1. Look up profile
        const { data: lookup } = await admin.rpc('pre_login_lookup', { _identifier: identifier })
        const profile: any = Array.isArray(lookup) ? lookup[0] : lookup

        if (!profile?.id) {
          // Generic error — do not leak whether the account exists
          return Response.json({ error: 'invalid_credentials' }, { status: 401 })
        }

        // 2. Suspension check
        if (profile.is_suspended || profile.account_status === 'suspended') {
          return Response.json({ error: 'account_suspended' }, { status: 403 })
        }

        // 3. Attempt sign-in with the resolved synthetic email
        const anon = getAnonClient()
        const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
          email: profile.email,
          password,
        })

        if (signInError || !signInData?.session) {
          // 4a. Record failure (server-side, behind a real attempt)
          const { data: newCount } = await admin.rpc('record_login_failure', { _user_id: profile.id })
          const attempts = typeof newCount === 'number' ? newCount : (profile.login_attempts || 0) + 1
          return Response.json(
            { error: 'invalid_credentials', attempts, remaining: Math.max(0, 5 - attempts) },
            { status: 401 },
          )
        }

        // 4b. Success — reset counter and return session for client to adopt
        await admin.rpc('record_login_success', { _user_id: profile.id })
        return Response.json({
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          },
        })
      },
    },
  },
})