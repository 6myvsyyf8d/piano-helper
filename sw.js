// Service Worker for 哆哩的钢琴助手
const CACHE = 'piano-v2';
const FILES = [
  '/piano-helper/',
  '/piano-helper/piano-helper.html',
  '/piano-helper/manifest.json',
  '/piano-helper/icon-192.png',
  '/piano-helper/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => {
    return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  }));
});
