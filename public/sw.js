/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'biodiesel-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) => cache.add(asset).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip API / auth requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.includes('vehicle-account') || url.hostname.includes('supabase')) {
    return;
  }

  // Handle navigation requests (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Let network requests fallback to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
