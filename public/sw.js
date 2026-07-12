// Messaging-only service worker for VibTribe notifications.
// Do not cache the app shell here: this worker exists only for Web Push.
let VAPID_PUBLIC_KEY = null;
const VAPID_CACHE = 'vibtribe-vapid-v1';
const VAPID_CACHE_URL = '/__vapid_public_key__';

async function loadVapidKey() {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const cache = await caches.open(VAPID_CACHE);
    const res = await cache.match(VAPID_CACHE_URL);
    if (res) VAPID_PUBLIC_KEY = (await res.text()) || null;
  } catch {}
  return VAPID_PUBLIC_KEY;
}

async function saveVapidKey(key) {
  if (!key || key === VAPID_PUBLIC_KEY) return;
  VAPID_PUBLIC_KEY = key;
  try {
    const cache = await caches.open(VAPID_CACHE);
    await cache.put(VAPID_CACHE_URL, new Response(key, { headers: { 'Content-Type': 'text/plain' } }));
  } catch {}
}

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = self.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SET_VAPID_PUBLIC_KEY' && typeof data.key === 'string') {
    event.waitUntil(saveVapidKey(data.key));
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('vibtribe-') && name !== VAPID_CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function parsePush(event) {
  const fallback = { title: 'VibTribe', body: 'You have a new notification', type: 'message', url: '/' };
  if (!event.data) return fallback;
  try { return { ...fallback, ...event.data.json() }; }
  catch {
    try { return { ...fallback, body: event.data.text() }; }
    catch { return fallback; }
  }
}

self.addEventListener('push', (event) => {
  const data = parsePush(event);
  const isCall = data.type === 'voice_call' || data.type === 'video_call';
  const title = data.title || (isCall ? 'Incoming call' : 'VibTribe');
  const targetUrl = new URL(data.url || '/', self.location.origin);
  if (data.chatId && !targetUrl.searchParams.get('chat')) targetUrl.searchParams.set('chat', data.chatId);
  if (isCall && data.callId && !targetUrl.searchParams.get('call')) targetUrl.searchParams.set('call', data.callId);
  const url = targetUrl.pathname + targetUrl.search + targetUrl.hash;
  const tag = data.tag || (isCall ? `call-${data.callId || data.callerId || Date.now()}` : `message-${data.chatId || 'chat'}-${data.timestamp || Date.now()}`);

  const options = {
    body: data.body || (isCall ? 'Incoming VibTribe call' : 'You have a new message'),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag,
    renotify: true,
    requireInteraction: isCall,
    silent: false,
    vibrate: isCall ? [400, 150, 400, 150, 700] : [180, 80, 180],
    timestamp: data.timestamp || Date.now(),
    data: { url, type: data.type, chatId: data.chatId, callerId: data.callerId, callId: data.callId },
    actions: isCall
      ? [{ action: 'answer', title: 'Answer' }, { action: 'decline', title: 'Decline' }]
      : [{ action: 'open', title: 'Open' }, { action: 'dismiss', title: 'Dismiss' }],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clientList.forEach((client) => client.postMessage(isCall ? { type: 'INCOMING_CALL', payload: data } : { type: 'PUSH_MESSAGE', payload: data }));
      } catch {}
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss' || event.action === 'decline') return;

  const data = event.notification.data || {};
  const targetUrl = new URL(data.url || '/', self.location.origin);
  if (data.chatId && !targetUrl.searchParams.get('chat')) targetUrl.searchParams.set('chat', data.chatId);
  if (data.callId && !targetUrl.searchParams.get('call')) targetUrl.searchParams.set('call', data.callId);
  if (event.action === 'answer') targetUrl.searchParams.set('answerCall', data.callId || '1');
  const message = event.action === 'answer' ? { type: 'ANSWER_CALL', payload: data } : { type: 'OPEN_NOTIFICATION', payload: data };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        existing.postMessage(message);
        return ('focus' in existing ? existing.focus() : Promise.resolve()).catch(() => null);
      }
      return self.clients.openWindow(targetUrl.href);
    })
  );
});

// Browsers (Chrome/FCM, Safari/APNs) occasionally rotate the push endpoint
// or invalidate the current subscription. Re-subscribe silently with the
// cached VAPID key and notify any open client so it can persist the new
// endpoint to the server. If no client is open, the client will pick up
// the fresh subscription on its next load (via getSubscription()) and
// upsert it there.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const key = await loadVapidKey();
      if (!key) return;
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(key),
      });
      const json = newSub.toJSON();
      const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((client) => client.postMessage({
        type: 'PUSH_SUBSCRIPTION_CHANGED',
        payload: { oldEndpoint, subscription: json },
      }));
    } catch (err) {
      // Swallow — client will re-subscribe on next visit.
    }
  })());
});