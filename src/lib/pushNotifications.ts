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
const LAST_SYNC_CACHE = 'vt_push_last_subscription_sync_at';

function isLovablePreviewHost(hostname: string): boolean {
  return hostname.startsWith('id-preview--')
    || hostname.startsWith('preview--')
    || hostname.endsWith('-dev.lovable.app')
    || hostname === 'lovableproject.com'
    || hostname.endsWith('.lovableproject.com')
    || hostname === 'lovableproject-dev.com'
    || hostname.endsWith('.lovableproject-dev.com')
    || hostname === 'beta.lovable.dev'
    || hostname.endsWith('.beta.lovable.dev');
}

function isFramed(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

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

// iOS Safari (16.4+) only allows Web Push when the site is installed to the
// Home Screen and launched as a standalone PWA. Detect that here so we can
// skip prompting inside mobile Safari tabs (where the request would fail).
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  return iOS;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return !!(mm || iosStandalone);
}

export function canRequestWebPush(): boolean {
  if (!isWebPushSupported()) return false;
  // On iOS, PushManager only works when launched from the Home Screen PWA.
  if (isIosDevice() && !isStandalonePwa()) return false;
  if (isFramed() || isLovablePreviewHost(window.location.hostname)) return false;
  return true;
}

export async function registerNewMessagePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  if (isFramed() || isLovablePreviewHost(window.location.hostname)) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter((r) => new URL(r.scope).origin === window.location.origin).map((r) => r.unregister()));
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('vibtribe-')).map((k) => caches.delete(k)));
      }
    } catch {}
    return null;
  }

  const existing = await navigator.serviceWorker.getRegistration('/');
  const registration = existing || await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  registration.update().catch(() => {});
  return registration;
}

async function getVapidPublicKey(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: { action: 'getPublicKey' },
  });
  if (error || !data?.publicKey) {
    const cached = sessionStorage.getItem(PUBLIC_KEY_CACHE);
    return cached || null;
  }
  sessionStorage.setItem(PUBLIC_KEY_CACHE, data.publicKey);
  return data.publicKey;
}

async function seedVapidKeyToServiceWorker(key: string) {
  try {
    await registerNewMessagePushServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'SET_VAPID_PUBLIC_KEY', key });
  } catch {}
}

function readLastSubscriptionSyncAt(): number {
  try { return Number(localStorage.getItem(LAST_SYNC_CACHE) || '0') || 0; } catch { return 0; }
}

function writeLastSubscriptionSyncAt() {
  try { localStorage.setItem(LAST_SYNC_CACHE, String(Date.now())); } catch {}
}

async function persistSubscription(
  supabase: any,
  userId: string,
  json: PushSubscriptionJSON,
  previousEndpoint?: string | null,
): Promise<boolean> {
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { error } = await (supabase as any).rpc('claim_push_subscription', {
    _endpoint: json.endpoint,
    _p256dh: json.keys.p256dh,
    _auth: json.keys.auth,
  });
  if (!error && previousEndpoint && previousEndpoint !== json.endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', previousEndpoint);
  }
  if (error) console.warn('[push] claim_push_subscription failed', error.message || error);
  return !error;
}

export async function ensurePushSubscription(supabase: any, userId: string): Promise<boolean> {
  if (!canRequestWebPush() || !userId) return false;

  // iOS 16.4+ PWA: `Notification.requestPermission()` MUST be triggered by
  // a user gesture. If we call it from an auto effect on 'default', Safari
  // silently returns 'denied' and permanently blocks the prompt until the
  // PWA is reinstalled. So only auto-request on non-iOS; on iOS require the
  // permission to already be 'granted' (a UI button should have triggered
  // the prompt beforehand).
  let permission = Notification.permission;
  if (permission === 'default') {
    if (isIosDevice()) {
      console.info('[push] iOS PWA: waiting for user gesture to request permission');
      return false;
    }
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  const publicKey = await getVapidPublicKey(supabase);
  if (!publicKey) {
    console.warn('[push] no VAPID public key available');
    return false;
  }
  await seedVapidKeyToServiceWorker(publicKey);

  const registered = await registerNewMessagePushServiceWorker();
  if (!registered) return false;

  const registration = await Promise.race([
    navigator.serviceWorker.ready.then((ready) => ready || registered),
    new Promise<ServiceWorkerRegistration>((_, reject) => window.setTimeout(() => reject(new Error('service worker not ready')), 8000)),
  ]);
  await registration.update().catch(() => {});
  let subscription = await registration.pushManager.getSubscription();

  // If a stored subscription exists but was created with a different VAPID key
  // (e.g. keys were rotated), the server will 401/403 pushes to it. Detect and
  // resubscribe so we always end up with a subscription bound to the current key.
  if (subscription) {
    try {
      const existingKey = subscription.options?.applicationServerKey;
      const expected = base64UrlToUint8Array(publicKey);
      const same = existingKey
        && new Uint8Array(existingKey as ArrayBuffer).every((byte, i) => byte === expected[i])
        && (existingKey as ArrayBuffer).byteLength === expected.byteLength;
      if (!same) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    } catch {}
  }

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      console.error('[push] pushManager.subscribe failed', err);
      return false;
    }
  }

  const ok = await persistSubscription(supabase, userId, subscription.toJSON());
  if (!ok) console.warn('[push] persistSubscription upsert failed');
  else writeLastSubscriptionSyncAt();
  return ok;
}

export async function requestWebPushPermissionAndSubscribe(supabase: any, userId: string): Promise<boolean> {
  if (!canRequestWebPush() || !userId) return false;
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return false;
  }
  if (Notification.permission !== 'granted') return false;
  return ensurePushSubscription(supabase, userId);
}

export function shouldRefreshPushSubscription(maxAgeMs = 5 * 60_000): boolean {
  return Date.now() - readLastSubscriptionSyncAt() > maxAgeMs;
}

// Listen for the SW's `pushsubscriptionchange` notification and persist the
// refreshed endpoint on behalf of the signed-in user. Idempotent — safe to
// call multiple times.
export function attachPushSubscriptionChangeListener(supabase: any, getUserId: () => string | null) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
    const uid = getUserId();
    if (!uid) return;
    const { subscription, oldEndpoint } = event.data.payload || {};
    if (!subscription) return;
    void persistSubscription(supabase, uid, subscription, oldEndpoint);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
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
    const isCall = payload.type === 'voice_call' || payload.type === 'video_call';
    const url = payload.url || (payload.callId ? `/?call=${encodeURIComponent(payload.callId)}${chatId ? `&chat=${encodeURIComponent(chatId)}` : ''}` : (chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/'));
    const tag = payload.type === 'message' ? notificationId : (payload.tag || notificationId);
    // Fire web-push (browser/PWA subscriptions) AND native FCM (Android app
    // tokens) in parallel — they target different transport channels and
    // recipients may have either, both, or neither.
    const webPushPromise = supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'send',
        ...payload,
        chat_id: chatId,
        url,
        tag,
        notification_id: notificationId,
        call_id: payload.callId,
        require_interaction: isCall,
        recipient_user_id: recipientId,
      },
    });

    // Native FCM message push (skip for calls — sendCallPush handles those
    // with the full-screen ringer payload).
    let fcmPromise: Promise<{ sent?: number } | null> = Promise.resolve(null);
    if (!isCall && recipientId) {
      fcmPromise = import('@/lib/fcm-push.functions')
        .then(({ sendMessagePush }) => sendMessagePush({ data: {
          recipientUserId: recipientId,
          chatId,
          title: payload.title,
          body: payload.body,
          url,
          tag,
        } }))
        .catch((e) => { console.warn('[Push] FCM message push failed', e); return null; });
    }

    const [webRes, fcmRes] = await Promise.all([webPushPromise, fcmPromise]);
    const webOk = !webRes?.error && (webRes?.data?.sent ?? 0) > 0;
    const fcmOk = (fcmRes?.sent ?? 0) > 0;
    return webOk || fcmOk;
  } catch (error) {
    console.error('[Push] send failed', error);
    return false;
  }
}