const CACHE_NAME = 'vibetribe-v8';
const STATIC_ASSETS = ['/manifest.json', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))),
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
  const fallback = { title: 'VibeTribe', body: 'You have a new notification', type: 'message', url: '/' };
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
  const title = data.title || (isCall ? 'Incoming call' : 'VibeTribe');
  const url = data.url || '/';

  const options = {
    body: data.body || (isCall ? 'Incoming VibeTribe call' : 'You have a new message'),
    icon: '/icons/icon-192x192.png',
    badge: '/favicon.ico',
    tag: data.tag || (isCall ? `call-${data.callerId || Date.now()}` : 'vibetribe-message'),
    renotify: true,
    requireInteraction: isCall,
    silent: false,
    vibrate: isCall ? [400, 150, 400, 150, 700] : [180, 80, 180],
    timestamp: data.timestamp || Date.now(),
    data: { url, type: data.type, chatId: data.chatId, callerId: data.callerId },
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
  const url = data.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage(event.action === 'answer' ? { type: 'ANSWER_CALL', payload: data } : { type: 'OPEN_NOTIFICATION', payload: data });
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});