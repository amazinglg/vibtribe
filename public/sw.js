// Bump on every release so installed PWAs pick up the latest build
// (auth/email branding, OTP throttling, profile + admin redesign, etc.).
const CACHE_NAME = 'vibtribe-v21';
const IMG_CACHE = 'vibtribe-images-v5';
const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.ico'];

// Cached VAPID public key so `pushsubscriptionchange` can re-subscribe
// without a live client window. Seeded via postMessage from the app on
// first load and persisted in Cache Storage so it survives SW restarts.
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME && name !== IMG_CACHE).map((name) => caches.delete(name)))),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    // Network-first for HTML navigations; fall back to cached page, then the app shell ('/').
    // NEVER fall back to /manifest.json — it would render raw JSON in the browser.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('/')))
    );
    return;
  }

  // Images: stale-while-revalidate — fast paint, refresh in background
  if (req.destination === 'image') {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
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
    badge: '/favicon.ico',
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage(isCall ? { type: 'INCOMING_CALL', payload: data } : { type: 'PUSH_MESSAGE', payload: data }));
      return self.registration.showNotification(title, options);
    })
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
      // Prefer focusing an existing window and letting the SPA update via postMessage.
      // Avoid client.navigate() — it triggers a full reload which loses the postMessage
      // (and on iOS PWA often fails silently), so the user sees "nothing happens".
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