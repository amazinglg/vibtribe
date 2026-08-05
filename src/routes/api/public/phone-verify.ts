import { createFileRoute } from '@tanstack/react-router';
import {
  adminClient,
  generateToken,
  hashToken,
  GATEWAY_NUMBER,
  DEFAULT_GATEWAY_ID,
} from '@/lib/sms-gateway.server';

// Authenticated (Supabase bearer token) endpoint that starts a phone
// verification. The raw token is returned exactly once; only its hash is
// persisted. Additive — no existing auth flow is touched.

async function userFromRequest(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export const Route = createFileRoute('/api/public/phone-verify')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
        const admin = adminClient();
        const { data } = await admin.rpc('sms_gw_phone_status', { _user_id: user.id });
        return Response.json({ ...(data as any), gateway_number: GATEWAY_NUMBER });
      },
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);

        const admin = adminClient();
        const { data, error } = await admin.rpc('sms_gw_create_claim', {
          _user_id: user.id,
          _token_hash: tokenHash,
          _gateway_id: DEFAULT_GATEWAY_ID,
        });

        if (error) {
          console.error('[phone-verify] claim failed', { user: user.id, code: error.code });
          return Response.json({ error: 'claim_failed' }, { status: 500 });
        }
        const res = data as any;
        if (!res?.ok) {
          const status = res?.error === 'rate_limited' ? 429 : 400;
          return Response.json({ error: res?.error || 'claim_failed' }, { status });
        }

        return Response.json({
          ok: true,
          token: rawToken, // returned once, never stored or logged
          sms_body: `VIBTRIBE VERIFY ${rawToken}`,
          send_to: GATEWAY_NUMBER,
          expires_at: res.expires_at,
        });
      },
    },
  },
});
