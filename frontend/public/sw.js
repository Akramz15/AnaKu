const CACHE_NAME = 'anaku-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/Logo AnaKu.png',
  '/favicon.svg'
];

// Install event: cache initial critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// Fetch event handler: required for Chrome PWA install prompt
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and cross-origin requests to prevent cache errors
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  // Stale-while-revalidate strategy
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => response); // fallback to cached on fail
        
        return response || fetchPromise;
      });
    })
  );
});
