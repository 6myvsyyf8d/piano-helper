const CACHE_NAME = 'piano3-v3';
const ASSETS = [
  '/piano-helper/piano3/',
  '/piano-helper/piano3/index.html',
  '/piano-helper/piano3/manifest.json',
  '/piano-helper/piano3/icon-192.png',
  '/piano-helper/piano3/icon-512.png'
];

// 安装
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 缓存优先策略
      if (response) {
        return response;
      }

      // 网络请求
      return fetch(event.request).then((fetchResponse) => {
        // 不缓存 API 请求
        if (event.request.url.includes('api.github.com')) {
          return fetchResponse;
        }

        // 缓存其他资源
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    }).catch(() => {
      // 离线时返回缓存的主页
      return caches.match('/piano-helper/piano3/index.html');
    })
  );
});
