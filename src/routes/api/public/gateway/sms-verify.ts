import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  adminClient,
  hashToken,
  fingerprint,
  hmacSha256Hex,
  timingSafeEqualHex,
} from '@/lib/sms-gateway.server';

// Server-to-server endpoint for the dedicated Auth Hub SMS gateway.
// HMAC-SHA256 authenticated, replay protected, idempotent by sms_id.
// Never logs the raw token, full MSISDN, SMS body or the shared secret.

const BodySchema = z.object({
  token: z.string().trim().min(4).max(64),
  from_msisdn: z.string().trim().min(7).max(20),
  sms_id: z.string().trim().min(1).max(128),
  received_at: z.string().trim().min(1).max(64).optional(),
});

const TOLERANCE_MS = 120_000;

export const Route = createFileRoute('/api/public/gateway/sms-verify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['SMS_GATEWAY_HMAC_SECRET'];
        if (!secret) {
          console.error('[sms-gateway] secret not configured');
          return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
        }

        // HTTPS only (allow local dev).
        const url = new URL(request.url);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
          return Response.json({ ok: false, error: 'https_required' }, { status: 400 });
        }

        const gatewayId = request.headers.get('x-vt-gateway-id') || '';
        const timestamp = request.headers.get('x-vt-timestamp') || '';
        const nonce = request.headers.get('x-vt-nonce') || '';
        const signature = request.headers.get('x-vt-signature') || '';

        if (!gatewayId || !timestamp || !nonce || !signature) {
          return Response.json({ ok: false, error: 'missing_auth_headers' }, { status: 401 });
        }
        if (gatewayId.length > 64 || nonce.length > 128) {
          return Response.json({ ok: false, error: 'invalid_auth_headers' }, { status: 401 });
        }

        const tsMs = /^\d+$/.test(timestamp)
          ? (timestamp.length <= 10 ? Number(timestamp) * 1000 : Number(timestamp))
          : Date.parse(timestamp);
        if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > TOLERANCE_MS) {
          return Response.json({ ok: false, error: 'timestamp_out_of_range' }, { status: 401 });
        }

        const rawBody = await request.text();
        if (rawBody.length > 4096) {
          return Response.json({ ok: false, error: 'payload_too_large' }, { status: 413 });
        }

        const expected = await hmacSha256Hex(secret, `${timestamp}.${nonce}.${rawBody}`);
        if (!timingSafeEqualHex(expected, signature)) {
          console.warn('[sms-gateway] invalid signature', { gatewayId, outcome: 'invalid_signature' });
          return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
        }

        const admin = adminClient();

        // Replay protection.
        const { data: nonceOk, error: nonceErr } = await admin
          .schema('sms_gw')
          .rpc('register_gateway_nonce', { _gateway_id: gatewayId, _nonce: nonce });
        if (nonceErr) {
          console.error('[sms-gateway] nonce store failed', { gatewayId, code: nonceErr.code });
          return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
        }
        if (nonceOk === false) {
          return Response.json({ ok: false, error: 'replay_detected' }, { status: 409 });
        }

        let parsed;
        try {
          parsed = BodySchema.parse(JSON.parse(rawBody));
        } catch {
          return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 });
        }
        if (!/^[0-9A-Za-z]{4,64}$/.test(parsed.token)) {
          return Response.json({ ok: false, error: 'invalid_token_format' }, { status: 400 });
        }

        const tokenHash = await hashToken(parsed.token);
        const receivedAt = parsed.received_at && !Number.isNaN(Date.parse(parsed.received_at))
          ? new Date(parsed.received_at).toISOString()
          : new Date().toISOString();

        const { data, error } = await admin.schema('sms_gw').rpc('consume_gateway_token', {
          _gateway_id: gatewayId,
          _sms_id: parsed.sms_id,
          _token_hash: tokenHash,
          _token_fingerprint: fingerprint(tokenHash),
          _from_msisdn: parsed.from_msisdn,
          _received_at: receivedAt,
        });

        if (error) {
          console.error('[sms-gateway] consume failed', {
            gatewayId, sms_id: parsed.sms_id, code: error.code,
          });
          return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
        }

        const res = data as any;
        console.info('[sms-gateway] processed', {
          gatewayId,
          sms_id: parsed.sms_id,
          token_fp: fingerprint(tokenHash),
          outcome: res?.outcome,
          duplicate: !!res?.duplicate,
        });

        if (res?.ok) {
          return Response.json({ ok: true, outcome: res.outcome, duplicate: !!res.duplicate });
        }
        const status = res?.outcome === 'already_verified' ? 200 : 422;
        return Response.json({ ok: false, outcome: res?.outcome || 'failed', duplicate: !!res?.duplicate }, { status });
      },
    },
  },
});
