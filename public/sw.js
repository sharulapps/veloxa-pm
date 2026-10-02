// ============================================================
// VELOXA Service Worker
// ============================================================

const CACHE_NAME = 'veloxa-v1';
const STATIC_CACHE = 'veloxa-static-v1';

// Files to cache for offline shell
const SHELL_FILES = [
  '/',
  '/app.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// External CDN resources to cache
const CDN_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching shell files');
      return cache.addAll(SHELL_FILES).catch(err => {
        console.log('[SW] Shell cache error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, Firebase, Cloudflare Worker requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firebaseapp.com')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('workers.dev')) return;
  if (url.hostname.includes('r2.dev')) return;
  if (url.hostname.includes('gstatic.com')) return;

  // CDN resources — cache first
  if (CDN_CACHE.some(u => event.request.url.includes(u.split('/').pop()))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App shell — network first, fallback to cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return caches.match('/app.html');
          });
        })
    );
    return;
  }

  // Static assets (icons, manifest) — cache first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|json|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default — network only
  event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
});

// ── Push Notifications (optional) ─────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'VELOXA notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'VELOXA', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
