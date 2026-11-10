const CACHE_NAME = 'appointment-manager-v12'; // Increment version v12
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/app_icon_512.png?v=12'
];

/** Icone delle notifiche push (generate da scripts/genera_icone_notifica.js) */
const NOTIFICA_ICONA = '/notification-icon.png?v=12'; // grande, a colori (cono arancione)
const NOTIFICA_BADGE = '/notification-badge.png?v=12'; // piccola, silhouette bianca (Android)

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

// ── Web Push Notifications ──────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const title = data.title || 'Agenda Guide';
    const options = {
      body: data.body,
      // Immagine grande: a colori, il cono arancione dell'autoscuola.
      icon: data.icon || NOTIFICA_ICONA,
      // Icona piccola (barra di stato Android): DEVE essere monocromatica bianca
      // su sfondo trasparente, altrimenti Android la mostra come quadratino bianco.
      badge: NOTIFICA_BADGE,
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Push event error:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
