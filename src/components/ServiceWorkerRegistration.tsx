import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ensurePushSubscription } from '@/lib/pushNotifications';
import { useChatStore } from '@/store/chatStore';

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
  const { setSelectedChatId } = useChatStore();
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
      host.includes('-dev.lovable.app') ||
      host.includes('lovableproject.com');

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

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);

  // Save push subscription when user logs in
  useEffect(() => {
    if (!user || subscriptionSavedRef.current) return;

    const setupPush = async () => {
      try {
        subscriptionSavedRef.current = await ensurePushSubscription(supabase, user.id);
      } catch {}
    };

    setupPush();

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') setupPush();
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [user]);

  // Listen for SW messages (incoming call from push)
  useEffect(() => {
    // Deep-link from notification tap: read ?chat= from the URL (set by
    // either the web-push SW redirect or the native FCM action handler)
    // and open that conversation. Runs on mount
    // and again on history changes so background/foreground taps both work.
    const openChatFromUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chat');
        if (chatId) {
          setSelectedChatId(chatId);
          // Clean the param so a later refresh doesn't keep re-opening it.
          const url = new URL(window.location.href);
          url.searchParams.delete('chat');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    };
    openChatFromUrl();
    window.addEventListener('popstate', openChatFromUrl);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'INCOMING_CALL') {
        playRingtone();
        const payload = event.data?.payload || {};
        window.dispatchEvent(new CustomEvent('vt-incoming-call', {
          detail: { callId: payload.callId, chatId: payload.chatId || null },
        }));
      } else if (
        event.data?.type === 'CALL_DECLINED' ||
        event.data?.type === 'ANSWER_CALL'
      ) {
        stopRingtone();
        const payload = event.data?.payload || {};
        const chatId = payload.chatId;
        if (chatId) setSelectedChatId(chatId);
        if (payload.callId) {
          const url = new URL(window.location.href);
          url.searchParams.set('call', payload.callId);
          if (chatId) url.searchParams.set('chat', chatId);
          window.history.pushState({}, '', url.toString());
          window.dispatchEvent(new CustomEvent('vt-call-url'));
        }
      } else if (event.data?.type === 'OPEN_NOTIFICATION') {
        const chatId = event.data?.payload?.chatId;
        if (chatId) setSelectedChatId(chatId);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    // Native (Capacitor) push-tap dispatches this event — same handler as
    // the SW `OPEN_NOTIFICATION` postMessage so deep-linking works on
    // Android too.
    const handleOpenChat = (e: Event) => {
      const chatId = (e as CustomEvent).detail?.chatId;
      if (chatId) setSelectedChatId(chatId);
    };
    window.addEventListener('vt-open-chat', handleOpenChat as EventListener);
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      window.removeEventListener('vt-open-chat', handleOpenChat as EventListener);
      window.removeEventListener('popstate', openChatFromUrl);
      stopRingtone();
    };
  }, [setSelectedChatId]);

  return null;
}
