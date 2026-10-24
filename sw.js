// ROADTRIP — service worker : hors-ligne + notifications
const CACHE = 'roadtrip-v9';
const SHELL = [
  './', './index.html', './style.css', './app.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord pour nos fichiers, cache si pas de connexion. Supabase n'est jamais mis en cache.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'ROADTRIP', body: event.data?.text() }; }
  const urgent = !!data.urgent;
  event.waitUntil(
    self.registration.showNotification(data.title || 'ROADTRIP', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/badge-96.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      requireInteraction: urgent,
      vibrate: urgent ? [600, 200, 600, 200, 600, 200, 600] : [120, 60, 120],
      data: { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.registration.scope)) {
          w.postMessage({ type: 'open', url: target });
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
