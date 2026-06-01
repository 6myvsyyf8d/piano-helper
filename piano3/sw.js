// Service Worker for 哆哩的钢琴助手 v3.0
const CACHE = 'piano3-v1';
const FILES = [
  '/piano-helper/piano3/',
  '/piano-helper/piano3/index.html',
  '/piano-helper/piano3/manifest.json',
  '/piano-helper/piano3/icon-192.png',
  '/piano-helper/piano3/icon-512.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {})));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // Network first for HTML
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache first for assets
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    clients.claim().then(() =>
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    )
  );
});
