// Self-destroying and cache-purging Service Worker
// This kills zombie service worker cache loops and restores pure network delivery.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Purging cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      console.log('Service Worker actively unregistering itself...');
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Bypass cache completely and fetch directly from network
  event.respondWith(fetch(event.request));
});
