const CACHE_NAME = "slidey-v11";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./app.js",
  "./supabase.config.js",
  "./manifest.webmanifest",
  "./image.png",
  "./icons/favicon-64.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => cachedResponse);

      if (cachedResponse) {
        return cachedResponse;
      }

      return networkFetch.then((response) => {
        if (response) {
          return response;
        }

        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
