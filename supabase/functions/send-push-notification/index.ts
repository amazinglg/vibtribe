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
    const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@vibetribe.in';
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
          { TTL: 86400, urgency: 'high', topic: safeText(body.tag, chatId ? `chat-${chatId}` : 'vibetribe').slice(0, 32) }
        );
        sent += 1;
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        else failed.push({ endpoint: sub.endpoint, status, message: error?.body || error?.message });
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