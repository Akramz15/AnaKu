const CACHE_NAME = 'anaku-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/Logo AnaKu.png',
  '/favicon.svg',
  '/QrisAnaKu.jpeg'
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
  // Hanya interupsi request GET dari asal (origin) yang sama
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // KUNCI UTAMA: Hanya intercept aset fisik statis yang kita cache secara eksplisit!
  // Ini mencegah service worker merusak navigasi Router React SPA (/parent, dsb) atau callback OAuth Google.
  const isCachedAsset = ASSETS_TO_CACHE.some(asset => {
    const assetPath = new URL(asset, self.location.origin).pathname;
    return url.pathname === assetPath;
  });

  if (isCachedAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Kembalikan aset dari cache jika ada, jika tidak ambil dari jaringan
        return cachedResponse || fetch(event.request);
      })
    );
  }

  // PENTING: Jika tidak di-cache (seperti rute dinamis /parent, endpoint API, atau callback Google), 
  // kita TIDAK memanggil event.respondWith(). Ini memerintahkan browser untuk memprosesnya secara normal 
  // tanpa campur tangan service worker sedikit pun. Solusi Anti-Bug 100%!
});

// Memaksa pembaharuan instan saat ada instruksi dari script utama
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
