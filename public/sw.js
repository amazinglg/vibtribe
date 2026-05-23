const CACHE_NAME = 'vibtribe-v11';
const IMG_CACHE = 'vibtribe-images-v1';
const STATIC_ASSETS = ['/manifest.json', '/favicon.ico'];

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
    event.respondWith(fetch(req).catch(() => caches.match(req).then((res) => res || caches.match('/manifest.json'))));
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
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage(message);
          const nav = 'navigate' in client ? client.navigate(targetUrl.href).catch(() => null) : Promise.resolve(null);
          return nav.then(() => client.focus());
        }
      }
      return self.clients.openWindow(targetUrl.href);
    })
  );
});