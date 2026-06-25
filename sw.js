const CACHE = 'inforwnet-v2';
const ASSETS = [
  '/inforwnet-vendas/',
  '/inforwnet-vendas/index.html',
  '/inforwnet-vendas/style.css',
  '/inforwnet-vendas/app.js',
  '/inforwnet-vendas/manifest.json',
  '/inforwnet-vendas/icon-192.png',
  '/inforwnet-vendas/icon-512.png',
  '/inforwnet-vendas/logo-de-carregamento.png'
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
