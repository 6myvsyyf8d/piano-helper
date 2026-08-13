/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
// Piano Helper Service Worker — 纯直通模式，不缓存
// 始终从网络获取最新文件，避免旧版 JS 被缓存导致功能异常

const CACHE_NAME = 'piano3-v5';

self.addEventListener('install', (event) => {
  console.log('SW: install (no cache)');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: activate — clearing all caches');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Fetch — 纯直通，不缓存任何内容
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});