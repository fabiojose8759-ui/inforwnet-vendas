const CACHE = 'inforwnet-v4';
const ASSETS = [
  '/inforwnet-v4endas/',
  '/inforwnet-v4endas/index.html',
  '/inforwnet-v4endas/style.css',
  '/inforwnet-v4endas/app.js',
  '/inforwnet-v4endas/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Não intercepta requisições do Firebase
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
