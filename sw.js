// Service worker 365Food — app shell offline + données.
// NB : la CI (deploy-pages.yml) remplace la version du cache par le SHA du
// commit à chaque déploiement — plus besoin de bump manuel pour livrer une
// mise à jour du shell.
const CACHE = "365food-v12";
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
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" contourne le cache HTTP (GitHub Pages sert avec
      // max-age=600) : sans lui, un bump de version peut re-cacher les
      // anciens fichiers encore « frais ».
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
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
          // Ne jamais écraser la copie en cache par une réponse d'erreur
          // (404 pendant un déploiement, portail captif…).
          if (res.ok) {
            const copy = res.clone();
            e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else if (e.request.mode === "navigate") {
    // Hors-ligne, une URL du scope avec query string (?utm_source=…) doit
    // quand même retomber sur le shell en cache.
    e.respondWith(
      caches
        .match(e.request, { ignoreSearch: true })
        .then((cached) => cached || caches.match("./index.html"))
        .then((cached) => cached || fetch(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});
