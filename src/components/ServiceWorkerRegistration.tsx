import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ensurePushSubscription } from '@/lib/pushNotifications';

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
        subscriptionSavedRef.current = await ensurePushSubscription(supabase, user.id);
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

  return null;
}
