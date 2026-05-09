import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToPush, savePushSubscription, sendPushNotification } from '@/lib/pushNotifications';

// Ringtone audio context for incoming calls
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

function playRingtone() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    const playBeep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime);
      osc.frequency.setValueAtTime(660, startTime + 0.15);
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    };

    const now = ctx.currentTime;
    playBeep(now);
    playBeep(now + 0.5);

    // Repeat every 2 seconds
    ringtoneInterval = setInterval(() => {
      const t = ctx.currentTime;
      playBeep(t);
      playBeep(t + 0.5);
    }, 2000);
  } catch {}
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

export default function ServiceWorkerRegistration() {
  const { user } = useAuth();
  const supabase = createClient();
  const subscriptionSavedRef = useRef(false);

  // Register SW and subscribe to push
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Never run the SW inside Lovable preview / iframe — it caches stale builds
    // and causes the "sad face" render crash on revisit.
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes('id-preview--') ||
      host.includes('lovableproject.com') ||
      host.includes('lovable.app');

    if (isInIframe || isPreviewHost) {
      // Unregister any previously installed SW + clear caches so stale shells go away.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Save push subscription when user logs in
  useEffect(() => {
    if (!user || subscriptionSavedRef.current) return;

    const setupPush = async () => {
      try {
        const subscription = await subscribeToPush();
        if (subscription) {
          await savePushSubscription(supabase, user.id, subscription);
          subscriptionSavedRef.current = true;
        }
      } catch {}
    };

    setupPush();
  }, [user]);

  // Listen for SW messages (incoming call from push)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'INCOMING_CALL') {
        playRingtone();
      } else if (
        event.data?.type === 'CALL_DECLINED' ||
        event.data?.type === 'ANSWER_CALL'
      ) {
        stopRingtone();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      stopRingtone();
    };
  }, []);

  // Listen for new messages and send push notifications to recipient
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-messages-push-notif')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new as any;

          // Get the chat to find the recipient
          const { data: chat } = await supabase
            .from('chats')
            .select('participant_one, participant_two')
            .eq('id', msg.chat_id)
            .single();

          if (!chat) return;

          const recipientId =
            chat.participant_one === user.id
              ? chat.participant_two
              : chat.participant_one;

          if (!recipientId) return;

          // Get sender name
          const { data: sender } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          const senderName = sender?.full_name || 'Someone';
          const messageText = msg.content
            ? msg.content.length > 60
              ? msg.content.substring(0, 60) + '…'
              : msg.content
            : 'Sent you a message';

          // Check secured chat notification preference for recipient
          const recipientSecureNotifKey = `vt_secure_notif_${recipientId}`;
          const isSecureChat = msg.is_encrypted || msg.encrypted;

          // Send push to recipient
          await sendPushNotification(supabase, {
            user_id: recipientId,
            title: `${senderName} — VibeTribe`,
            body: isSecureChat ? '🔒 New secure message' : messageText,
            tag: `msg-${msg.chat_id}`,
            url: '/',
            type: 'message',
          });

          // Also show local notification if app is in background
          if (
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            new Notification(`${senderName} — VibeTribe`, {
              body: isSecureChat ? '🔒 New secure message' : messageText,
              icon: '/favicon.ico',
              tag: `msg-${msg.chat_id}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
