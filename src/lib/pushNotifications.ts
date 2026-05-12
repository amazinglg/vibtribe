type PushKind = 'message' | 'voice_call' | 'video_call' | 'status';

export type PushPayload = {
  recipient_user_id?: string;
  user_id?: string;
  chat_id?: string | null;
  title: string;
  body: string;
  tag?: string;
  url?: string;
  type?: PushKind;
  callerId?: string;
  callId?: string;
};

const PUBLIC_KEY_CACHE = 'vt_vapid_public_key';

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

async function getVapidPublicKey(supabase: any): Promise<string | null> {
  const cached = sessionStorage.getItem(PUBLIC_KEY_CACHE);
  if (cached) return cached;

  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
  if (envKey) {
    sessionStorage.setItem(PUBLIC_KEY_CACHE, envKey);
    return envKey;
  }

  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: { action: 'getPublicKey' },
  });
  if (error || !data?.publicKey) return null;
  sessionStorage.setItem(PUBLIC_KEY_CACHE, data.publicKey);
  return data.publicKey;
}

export async function ensurePushSubscription(supabase: any, userId: string): Promise<boolean> {
  if (!isWebPushSupported() || !userId) return false;

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') return false;

  const publicKey = await getVapidPublicKey(supabase);
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.ready;
  await registration.update().catch(() => {});
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  return !error;
}

export async function removePushSubscription(supabase: any, userId: string): Promise<void> {
  if (!isWebPushSupported() || !userId) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

export async function sendPushNotification(supabase: any, payload: PushPayload): Promise<boolean> {
  const recipientId = payload.recipient_user_id || payload.user_id;
  if (!recipientId && !payload.chat_id) return false;

  try {
    const chatId = payload.chat_id || null;
    const notificationId = `${payload.type || 'message'}-${chatId || recipientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = payload.url || (chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/');
    const tag = payload.tag || notificationId;
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'send',
        ...payload,
        chat_id: chatId,
        url,
        tag,
        notification_id: notificationId,
        recipient_user_id: recipientId,
      },
    });
    return !error && data?.sent !== 0;
  } catch (error) {
    console.error('[Push] send failed', error);
    return false;
  }
}