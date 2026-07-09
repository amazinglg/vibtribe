// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const safeText = (value: unknown, fallback = '') => String(value || fallback).slice(0, 160);
const safePath = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    // NOTE: iOS/APNs rejects pushes whose VAPID `sub` claim points at a
    // non-existent domain. Default MUST match the real production domain
    // (vibtribe.in — was a typo `vibetribe.in` before which caused APNs
    // to silently drop iOS PWA pushes).
    const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@vibtribe.in';
    const body = await req.json().catch(() => ({}));

    if (body.action === 'getPublicKey') {
      return json({ publicKey });
    }
    if (!publicKey || !privateKey) return json({ error: 'Push keys are not configured' }, 500);

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const callerId = authData.user.id;
    const recipientId = body.recipient_user_id || body.user_id;
    const chatId = body.chat_id || null;
    if (!recipientId) return json({ error: 'recipient_user_id required' }, 400);
    if (recipientId === callerId) return json({ sent: 0, skipped: 'self' });

    // Hard UUID check on both ids before any filter interpolation.
    // Prevents PostgREST filter injection (e.g. a payload containing `,` or `)`
    // that would otherwise escape the .or() clause and forge "allowed = true").
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(recipientId))) {
      return json({ error: 'Invalid recipient_user_id' }, 400);
    }
    if (chatId && !UUID_RE.test(String(chatId))) {
      return json({ error: 'Invalid chat_id' }, 400);
    }

    // Per-caller push abuse cap: 120 pushes / 60s window.
    try {
      const { data: allowedByLimit } = await admin.rpc('rate_limit_hit', {
        _key: `push:${callerId}`,
        _max: 120,
        _window_secs: 60,
      });
      if (allowedByLimit === false) {
        return json({ error: 'Rate limit exceeded' }, 429);
      }
    } catch (e) {
      console.warn('[push] rate_limit_hit failed', e);
    }

    let allowed = false;
    if (chatId) {
      const { data: chat } = await admin
        .from('chats')
        .select('id, participant_one, participant_two, is_group')
        .eq('id', chatId)
        .single();
      if (chat?.is_group) {
        const { data: members } = await admin
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chatId)
          .in('user_id', [callerId, recipientId]);
        allowed = new Set((members || []).map((m: any) => m.user_id)).size === 2;
      } else {
        allowed = !!chat && [chat.participant_one, chat.participant_two].includes(callerId)
          && [chat.participant_one, chat.participant_two].includes(recipientId);
      }
    } else {
      const { data: direct } = await admin.from('chats').select('id').or(
        `and(participant_one.eq.${callerId},participant_two.eq.${recipientId}),and(participant_one.eq.${recipientId},participant_two.eq.${callerId})`
      ).limit(1);
      allowed = !!direct?.length;
    }
    if (!allowed) return json({ error: 'Forbidden' }, 403);

    // Secured-chat notification policy:
    // If the recipient has marked this chat as Secured AND has the
    // "Secured Chat Notifications" toggle off, suppress the push entirely.
    // (The default behavior is "silenced" per the profile setting.)
    if (chatId && body.type !== 'voice_call' && body.type !== 'video_call') {
      try {
        const [{ data: secureMark }, { data: prefProfile }] = await Promise.all([
          admin.from('user_secure_chats').select('chat_id').eq('user_id', recipientId).eq('chat_id', chatId).maybeSingle(),
          admin.from('user_profiles').select('notif_secure_chats').eq('id', recipientId).maybeSingle(),
        ]);
        const isSecured = !!secureMark;
        const wantsSecuredNotifs = !!prefProfile?.notif_secure_chats;
        if (isSecured && !wantsSecuredNotifs) {
          return json({ sent: 0, skipped: 'secured_chat_silenced' });
        }
      } catch (e) {
        console.warn('[push] secured-chat preference check failed', e);
      }
    }

    // Suppress when the recipient is actively viewing this exact chat in the
    // foreground (heartbeat < 35s old). Applies to messages only, not calls.
    if (chatId && body.type !== 'voice_call' && body.type !== 'video_call') {
      try {
        const { data: active } = await admin
          .from('user_active_chat')
          .select('chat_id, updated_at')
          .eq('user_id', recipientId)
          .maybeSingle();
        if (active && active.chat_id === chatId && active.updated_at
            && Date.now() - new Date(active.updated_at).getTime() < 35_000) {
          return json({ sent: 0, skipped: 'active_viewer' });
        }
      } catch (e) {
        console.warn('[push] active-viewer check failed', e);
      }
    }

    const { data: subscriptions, error: subError } = await admin
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', recipientId);
    if (subError) return json({ error: subError.message }, 500);
    if (!subscriptions?.length) return json({ sent: 0, total: 0, message: 'No device subscription for this user' });

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const payload = JSON.stringify({
      title: safeText(body.title, 'VibeTribe'),
      body: safeText(body.body, 'You have a new notification'),
      tag: safeText(body.tag, chatId ? `chat-${chatId}` : 'vibetribe'),
      url: safePath(body.url),
      type: body.type || 'message',
      chatId,
      callerId,
      callId: body.call_id || body.callId || null,
      timestamp: Date.now(),
    });

    let sent = 0;
    const expired: string[] = [];
    const failed: Array<{ endpoint: string; status?: number; message?: string }> = [];
    await Promise.all(subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          // No `topic`: FCM/APNs use it to COLLAPSE notifications with the same value,
          // which made later chat messages silently overwrite earlier ones on Android
          // when the device was offline/locked. Each push must show independently.
          // iOS APNs caps TTL and prefers shorter values for message pushes.
          // 12h is plenty and avoids APNs dropping the push as "too long".
          { TTL: 43200, urgency: 'high' }
        );
        sent += 1;
      } catch (error: any) {
        const status = error?.statusCode;
        const bodyMsg = String(error?.body || error?.message || '');
        console.warn('[push] delivery error', { status, bodyMsg, endpoint: sub.endpoint?.slice(0, 60) });
        // Stale-subscription detection:
        //  - 404/410           → endpoint gone (Chrome/FCM + Firefox)
        //  - 401              → FCM rejects the VAPID JWT (key was rotated)
        //  - 403 BadJwtToken / VapidPkHashMismatch → Apple/FCM rejected our VAPID auth
        // In all of these cases the saved subscription is unusable, so we drop it
        // and the client will re-subscribe with the current key on next visit.
        if (
          status === 404 ||
          status === 410 ||
          status === 401 ||
          (status === 403 && /BadJwtToken|VapidPkHashMismatch|JWT|vapid/i.test(bodyMsg))
        ) {
          expired.push(sub.endpoint);
        } else {
          failed.push({ endpoint: sub.endpoint, status, message: bodyMsg });
        }
      }
    }));

    if (expired.length) await admin.from('push_subscriptions').delete().in('endpoint', expired);
    if (failed.length) console.error('[push] failed deliveries', failed);
    return json({ sent, total: subscriptions.length, expired: expired.length, failed: failed.length });
  } catch (error: any) {
    console.error('[push] fatal', error);
    return json({ error: error?.message || String(error) }, 500);
  }
});