const CACHE_NAME = 'appointment-manager-v4'; // Increment version v4
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/app_icon_512.png'
];

// Install: Cache core assets and skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: Clean up ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy: NETWORK FIRST for everything to solve iOS caching issues
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Global Network-First strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // Absolute fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
