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
    callType: 'voice' | 'video';
    chatId?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const callerId = context.userId;

    // Verify a real ringing call exists between this caller and callee.
    // Without this any authenticated user could spam fake incoming-call
    // pushes to any other user.
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', data.callId)
      .eq('caller_id', callerId)
      .eq('callee_id', data.calleeId)
      .eq('status', 'ringing')
      .maybeSingle();
    if (!callRow) {
      console.warn('[FCM] sendCallPush rejected — no matching ringing call', { callerId, calleeId: data.calleeId });
      return { sent: 0 };
    }

    // Look up caller display name/avatar (used by the Android service to
    // render the incoming-call screen).
    let callerName = 'Unknown';
    let callerAvatar = '';
    try {
      const { data: prof } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', callerId)
        .maybeSingle();
      if (prof) {
        callerName = prof.full_name || prof.username || 'Unknown';
        callerAvatar = prof.avatar_url || '';
      }
    } catch {}

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
            callerName,
            callerAvatar,
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

// ---------- Server function: send chat-message push to native Android ----------
// Mirrors the web-push edge function but targets Android FCM tokens so the
// device shows a real system notification + plays the ringtone, even when
// the app is killed. Verifies the sender is a participant of the chat.
export const sendMessagePush = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    recipientUserId: string;
    chatId?: string | null;
    title: string;
    body: string;
    url?: string;
    tag?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    const recipientId = data.recipientUserId;
    if (!recipientId || recipientId === callerId) return { sent: 0 };

    // Authorize: caller must share the chat with recipient.
    const chatId = data.chatId || null;
    let allowed = false;
    if (chatId) {
      const { data: chat } = await supabaseAdmin
        .from('chats')
        .select('id, participant_one, participant_two, is_group')
        .eq('id', chatId)
        .maybeSingle();
      if (chat?.is_group) {
        const { data: members } = await supabaseAdmin
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chatId)
          .in('user_id', [callerId, recipientId]);
        allowed = new Set((members || []).map((m: any) => m.user_id)).size === 2;
      } else if (chat) {
        allowed = [chat.participant_one, chat.participant_two].includes(callerId)
          && [chat.participant_one, chat.participant_two].includes(recipientId);
      }
    } else {
      const { data: direct } = await supabaseAdmin.from('chats').select('id').or(
        `and(participant_one.eq.${callerId},participant_two.eq.${recipientId}),and(participant_one.eq.${recipientId},participant_two.eq.${callerId})`
      ).limit(1);
      allowed = !!direct?.length;
    }
    if (!allowed) return { sent: 0, error: 'forbidden' };

    // Respect per-chat mute preferences — never push to a chat the recipient muted.
    if (chatId) {
      try {
        const { data: muted } = await supabaseAdmin
          .from('chat_mutes')
          .select('chat_id, muted_until')
          .eq('user_id', recipientId)
          .eq('chat_id', chatId)
          .maybeSingle();
        if (muted && (!muted.muted_until || new Date(muted.muted_until).getTime() > Date.now())) {
          return { sent: 0, muted: true };
        }
      } catch (e) { /* fail-open: better to deliver than silently drop */ }
    }

    const { data: tokens } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', recipientId);
    if (!tokens || tokens.length === 0) return { sent: 0 };

    const accessToken = await getFcmAccessToken();
    const projectId = getProjectId();
    if (!accessToken || !projectId) return { sent: 0 };

    const safe = (s: string, n = 160) => String(s || '').slice(0, n);
    const title = safe(data.title || 'VibTribe', 80);
    const body = safe(data.body || 'New message', 160);
    const url = (typeof data.url === 'string' && data.url.startsWith('/')) ? data.url
      : (chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/');
    const tag = safe(data.tag || (chatId ? `chat-${chatId}` : 'vibtribe'), 80);

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    let sent = 0;
    const invalidTokens: string[] = [];
    await Promise.all(tokens.map(async ({ token }) => {
      const payload = {
        message: {
          token,
          // notification block makes Android render a system notification
          // even when the app is killed; data carries the deep-link target.
          notification: { title, body },
          data: {
            type: 'message',
            chatId: chatId || '',
            url,
            tag,
          },
          android: {
            priority: 'HIGH',
            ttl: '86400s',
            notification: {
              tag,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              channel_id: 'vibtribe_messages',
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
        },
      };
      try {
        const res = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) { sent++; return; }
        const txt = await res.text();
        console.error('[FCM][msg] send failed', res.status, txt);
        if (res.status === 404 || res.status === 400) invalidTokens.push(token);
      } catch (e) {
        console.error('[FCM][msg] send threw', e);
      }
    }));

    if (invalidTokens.length) {
      await supabaseAdmin.from('fcm_tokens').delete().in('token', invalidTokens);
    }
    return { sent };
  });