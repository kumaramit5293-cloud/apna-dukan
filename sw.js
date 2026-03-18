// अपना दुकान — Service Worker v4
const CACHE = 'apna-dukan-v4';
const APP = '/apna-dukan/';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.add(APP)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase — network only, no cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // CDN assets — cache first, no clone bug
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          // FIX: clone BEFORE reading, store clone in cache
          const toCache = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
          return r;
        });
      })
    );
    return;
  }

  // App shell — cache first, update in background
  if (url.pathname.startsWith(APP)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // FIX: fetch first, clone for cache, return original
        const network = fetch(e.request).then(r => {
          if (r.ok) {
            const toCache = r.clone(); // clone BEFORE returning r
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          }
          return r;
        }).catch(() => null);
        return cached || network;
      })
    );
  }
});
