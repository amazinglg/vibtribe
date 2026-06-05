import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// ---------- FCM v1 access-token (cached per Worker isolate) ----------
let cachedToken: { token: string; exp: number } | null = null;

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getFcmAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON missing');
    return null;
  }
  let sa: any;
  try { sa = JSON.parse(raw); } catch (e) { console.error('[FCM] invalid JSON', e); return null; }

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    console.error('[FCM] token exchange failed', res.status, await res.text());
    return null;
  }
  const tok = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: tok.access_token, exp: now + (tok.expires_in || 3600) };
  return tok.access_token;
}

function getProjectId(): string | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try { return JSON.parse(raw).project_id || null; } catch { return null; }
}

// ---------- Server function: send incoming-call push ----------
export const sendCallPush = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    callId: string;
    calleeId: string;
    callerName?: string;
    callerAvatar?: string;
    callType: 'voice' | 'video';
    chatId?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const callerId = context.userId;

    // Fetch all Android FCM tokens for callee
    const { data: tokens, error } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', data.calleeId);
    if (error) { console.error('[FCM] token lookup failed', error); return { sent: 0 }; }
    if (!tokens || tokens.length === 0) return { sent: 0 };

    const accessToken = await getFcmAccessToken();
    const projectId = getProjectId();
    if (!accessToken || !projectId) return { sent: 0 };

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    let sent = 0;
    const invalidTokens: string[] = [];
    await Promise.all(tokens.map(async ({ token }) => {
      const body = {
        message: {
          token,
          // Data-only payload — Android service constructs the full-screen notif
          data: {
            type: 'incoming_call',
            callId: data.callId,
            callerId,
            callerName: data.callerName || 'Unknown',
            callerAvatar: data.callerAvatar || '',
            callType: data.callType,
            chatId: data.chatId || '',
          },
          android: {
            priority: 'HIGH',
            ttl: '45s',
          },
        },
      };
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (res.ok) { sent++; return; }
        const txt = await res.text();
        console.error('[FCM] send failed', res.status, txt);
        if (res.status === 404 || res.status === 400) invalidTokens.push(token);
      } catch (e) {
        console.error('[FCM] send threw', e);
      }
    }));

    if (invalidTokens.length) {
      await supabaseAdmin.from('fcm_tokens').delete().in('token', invalidTokens);
    }
    return { sent };
  });