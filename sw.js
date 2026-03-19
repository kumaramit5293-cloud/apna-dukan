// My Shop - Service Worker v6
var CACHE = 'my-shop-v6';

// Dynamic scope - works on any GitHub Pages URL
var SCOPE = self.registration.scope;

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.add(SCOPE);
    }).catch(function() {})
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Supabase - always network only, never cache
  if (url.hostname.indexOf('supabase.co') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN assets - cache first
  if (url.hostname.indexOf('jsdelivr.net') !== -1 ||
      url.hostname.indexOf('cdnjs.cloudflare.com') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(r) {
          var toCache = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, toCache); });
          return r;
        });
      })
    );
    return;
  }

  // App shell - cache first, update in background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        var network = fetch(e.request).then(function(r) {
          if (r.ok) {
            var toCache = r.clone();
            caches.open(CACHE).then(function(c) { c.put(e.request, toCache); });
          }
          return r;
        }).catch(function() { return null; });
        return cached || network;
      })
    );
  }
});
