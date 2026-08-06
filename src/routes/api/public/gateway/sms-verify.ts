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
// HMAC-SHA256 authenticated against a provisioned device in sms_gw.gateways,
// replay protected, idempotent by sms_id.
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

        let admin;
        try {
          admin = adminClient();
        } catch {
          console.error('[sms-gateway] backend not configured');
          return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
        }

        // Look up the provisioned device. Unknown / revoked devices are rejected.
        const { data: gw, error: gwErr } = await admin.rpc('sms_gw_get_gateway_auth', {
          _device_id: gatewayId,
        });
        if (gwErr) {
          console.error('[sms-gateway] gateway lookup failed', { gatewayId, code: gwErr.code });
          return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
        }
        const gateway = gw as { status?: string; secret_hash?: string } | null;
        if (!gateway?.secret_hash) {
          console.warn('[sms-gateway] unknown device', { gatewayId });
          return Response.json({ ok: false, error: 'unknown_device' }, { status: 401 });
        }
        if (gateway.status !== 'active') {
          console.warn('[sms-gateway] revoked device', { gatewayId });
          return Response.json({ ok: false, error: 'device_revoked' }, { status: 401 });
        }

        // Signing key is the stored per-device key (a hash of the plaintext secret,
        // which the device derives locally; the plaintext is never stored server-side).
        const expected = await hmacSha256Hex(gateway.secret_hash, `${timestamp}.${nonce}.${rawBody}`);
        if (!timingSafeEqualHex(expected, signature)) {
          console.warn('[sms-gateway] invalid signature', { gatewayId, outcome: 'invalid_signature' });
          return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
        }

        // Replay protection.
        const { data: nonceOk, error: nonceErr } = await admin
          .rpc('sms_gw_register_nonce', { _gateway_id: gatewayId, _nonce: nonce });
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

        const { data, error } = await admin.rpc('sms_gw_consume_token', {
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
        // Authenticated request processed — record liveness.
        await admin.rpc('sms_gw_touch_gateway', { _device_id: gatewayId });
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
