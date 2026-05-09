/**
 * Web Push Notification utilities
 * Handles VAPID subscription, saving to Supabase, and triggering push via Edge Function
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe the current device to Web Push notifications.
 * Returns the PushSubscription or null if not supported / permission denied.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push disabled');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription first
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    return subscription;
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    return null;
  }
}

/**
 * Save a PushSubscription to Supabase for the given user.
 */
export async function savePushSubscription(
  supabase: any,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
}

/**
 * Remove the current device's push subscription from Supabase.
 */
export async function removePushSubscription(
  supabase: any,
  userId: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  } catch {}
}

/**
 * Trigger a push notification for a user via Supabase Edge Function.
 * Called server-side or from a trusted context (e.g., after inserting a message).
 */
export async function sendPushNotification(
  supabase: any,
  payload: {
    user_id: string;
    title: string;
    body: string;
    tag?: string;
    url?: string;
    type?: 'message' | 'voice_call' | 'video_call';
    callerId?: string;
  }
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });
  } catch (err) {
    console.error('[Push] Send error:', err);
  }
}
