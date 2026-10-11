/* Service worker — offline-first precache for تاريخ ابن خلدون */
const VERSION = '1.0.5';
const CACHE = 'tarikh-ibn-khaldun-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './book-data.js',
  './manifest.json',
  './icon.svg',
  './fonts/Amiri-Regular.woff2',
  './fonts/Amiri-Bold.woff2',
  './fonts/Cairo-Regular.woff2',
  './fonts/Cairo-Bold.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Network-first for page navigations so CSS/JS updates land immediately.
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        const shell = await cache.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
        throw err;
      }
    }
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      throw err;
    }
  })());
});
