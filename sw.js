// Service worker 365Food — app shell offline + données.
const CACHE = "365food-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./data/recipes.json",
  "./data/resto.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-maskable.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first pour les données (fraîcheur), cache-first pour le reste.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isData = e.request.url.includes("/data/");
  if (isData) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});
