const CACHE_NAME = "qingran-v2";
const APP_SCOPE = "/qingran-app/";
const APP_INDEX = `${APP_SCOPE}index.html`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([APP_SCOPE, APP_INDEX]))
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(APP_SCOPE)))
    );
    return;
  }

  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((client) => {
          if (client.url.includes(APP_SCOPE)) {
            client.navigate(client.url);
          }
        });
      })
  );
});
