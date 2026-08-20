/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 * Service Worker — 自动更新 + 离线基础支持
 */

const SW_VERSION = 'v4.0_20260820';
const CACHE_NAME = 'piano-v4-' + SW_VERSION;

// 需要预缓存的静态资源
const PRECACHE = [
  './',
  'css/style.css',
  'js/app.js',
  'js/data.js',
  'js/managers.js',
  'js/events.js',
  'js/schema.js',
  'js/storage-adapter.js',
  'js/feedback.js',
  'js/lesson-audio.js',
  'js/lesson-markers.js',
  'js/sheet-annotator.js',
  'js/feedback-organizer.js',
  'js/suggestions.js',
  'js/onboarding.js',
  'js/lessons.js',
  'js/calendar.js',
  'js/stats.js',
  'js/qrcode-generator.min.js',
  'js/html5-qrcode.min.js',
  'js/today/state.js',
  'js/today/render.js',
  'js/today/timer.js',
  'js/today/review-free.js',
  'js/today/submit.js',
  'js/today/celebrate.js',
  'js/repertoire/browser.js',
  'js/repertoire/editor.js',
  'js/repertoire/sync.js'
];

// ── Install: 预缓存静态资源 ──
self.addEventListener('install', (event) => {
  console.log('SW ' + SW_VERSION + ': installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE).catch((err) => {
        console.warn('SW: precache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: 清理旧缓存 ──
self.addEventListener('activate', (event) => {
  console.log('SW ' + SW_VERSION + ': activated');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: 缓存优先，网络更新 ──
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求和 chrome-extension 请求
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 发起网络请求更新缓存
      var fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // 网络不可用，返回缓存（如果有的话）
        return cached || new Response('Offline', { status: 503 });
      });

      // 有缓存则立即返回缓存，同时后台更新
      return cached || fetchPromise;
    })
  );
});

// ── 通知客户端有更新可用 ──
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});