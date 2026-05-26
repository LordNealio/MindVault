const CACHE_NAME = "workwrite-v1";
const OFFLINE_PAGE = "/";
const PRECACHE_URLS = ["/", "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname === "api.anthropic.com") {
    event.respondWith(fetch(request));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(fetch(request).catch(() => new Response("", { status: 408 })));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => { caches.open(CACHE_NAME).then(c => c.put(request, res.clone())); return res; })
        .catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then(res => { caches.open(CACHE_NAME).then(c => c.put(request, res.clone())); return res; })
      .catch(() => caches.match(request))
  );
});
