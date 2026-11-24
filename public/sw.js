// One-time migration for clients of the previous Vite PWA build. The current
// app no longer registers a service worker, so clear only Workbox precache
// entries and remove this worker after it replaces the old one.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('workbox-precache-'))
        .map((cacheName) => caches.delete(cacheName)),
    );

    await self.clients.claim();
    await self.registration.unregister();
  })());
});
