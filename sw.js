// Piano Helper v3 Service Worker
// Network-first strategy + update notification
const CACHE_NAME = 'piano3-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache assets, but DON'T skipWaiting (let user decide)
self.addEventListener('install', (event) => {
  console.log('SW: installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // NO skipWaiting — wait for user to activate
});

// Activate — clean old caches, claim clients
self.addEventListener('activate', (event) => {
  console.log('SW: activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('SW: deleting old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first, cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((fetchResponse) => {
        // Cache successful responses for core assets
        if (fetchResponse.ok && !event.request.url.includes('api.github.com')) {
          const clone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return fetchResponse;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});

// Notify all clients when a new version is waiting
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
