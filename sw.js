const CACHE_NAME = 'uluceeit-pwa-v15';
const STATIC_ASSETS = [
  './',
  './index.html',
  './sponsorlar.html',
  './etkinlikler.html',
  './hakkimizda.html',
  './oyun.html',
  './kutu-baski.html',
  './js/member-system.js',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

// Install: Statik varlıkları önbelleğe al
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Eski önbellekleri anında temizle ve istemcileri devral
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Ağ öncelikli (Network First) - Çevrimdışıyken önbellekten sun
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // MantleDB bulut veritabanı veya API isteklerini asla önbelleğe alma
  if (url.origin.includes('mantledb.sh') || event.request.method !== 'GET') {
    return;
  }

  // HTML sayfaları ve JS kodları için: Network First, Fallback to Cache
  if (
    event.request.mode === 'navigate' || 
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Görseller, CSS ve Fontlar için: Cache First, Fallback to Network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});
