// @ts-nocheck
// Sends Web Push notifications using `web-push` (npm) so payloads are properly
// encrypted with the subscriber's p256dh + auth keys. Without encryption, push
// services either drop the message or deliver an empty `event.data` body.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerToken = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authErr } = await authClient.auth.getUser(callerToken);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, title, body, tag, url, type } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const callerId = authData.user.id;
    if (user_id !== callerId) {
      const { data: shared } = await admin
        .from('chats').select('id')
        .or(
          `and(participant_one.eq.${callerId},participant_two.eq.${user_id}),` +
          `and(participant_one.eq.${user_id},participant_two.eq.${callerId})`
        ).limit(1);
      let allowed = !!(shared && shared.length);
      if (!allowed) {
        const { data: groups } = await admin
          .from('chat_members').select('chat_id').eq('user_id', callerId);
        const chatIds = (groups || []).map((g: any) => g.chat_id);
        if (chatIds.length > 0) {
          const { data: target } = await admin
            .from('chat_members').select('chat_id').eq('user_id', user_id)
            .in('chat_id', chatIds).limit(1);
          allowed = !!(target && target.length);
        }
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let safeUrl = '/';
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) safeUrl = url;

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@vibetribe.app';
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions } = await admin
      .from('push_subscriptions').select('*').eq('user_id', user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: title || 'VibeTribe',
      body: body || 'You have a new notification',
      tag: tag || 'vibetribe-notif',
      url: safeUrl,
      type: type || 'message',
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];
    await Promise.all(subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400, urgency: 'high' }
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 410 || status === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error('[push] send error', status, err?.body || err?.message);
        }
      }
    }));

    if (expiredEndpoints.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[push-notification] Error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});