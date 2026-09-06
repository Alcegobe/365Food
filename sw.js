/**
 * Service worker (V4) : l'application fonctionne hors ligne et s'installe comme PWA.
 *
 * Stratégie « cache d'abord, puis revalidation » : tout le shell (HTML, CSS, JS, données, icônes)
 * est mis en cache à l'installation ; chaque requête est servie depuis le cache, puis revérifiée
 * sur le réseau en arrière-plan. Quand un fichier a changé sur le serveur, le cache est mis à jour
 * et les pages ouvertes reçoivent { type: 'updated' } : l'application propose de recharger.
 * Les caches des versions précédentes (dont ceux de l'ancienne app) sont supprimés à l'activation.
 */
const CACHE = '365food-shell-v1';
const SHELL = [
  'index.html',
  'manifest.json',
  'css/app.css',
  'css/print.css',
  'js/app.js',
  'js/charts.js',
  'js/config.js',
  'js/custom-recipes.js',
  'js/nutrition.js',
  'js/planner.js',
  'js/profile.js',
  'js/recipes.js',
  'js/router.js',
  'js/store.js',
  'js/theme.js',
  'js/ui/dashboard.js',
  'js/ui/dom.js',
  'js/ui/icons.js',
  'js/ui/planner.js',
  'js/ui/profile-form.js',
  'js/ui/recipe-detail.js',
  'js/ui/recipe-form.js',
  'js/ui/recipes-list.js',
  'data/ingredients.json',
  'data/recipes.json',
  'img/icon.svg',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Toute navigation (démarrage, rechargement) reçoit le shell : le routage se fait dans la page (#/…).
  const key = request.mode === 'navigate' ? 'index.html' : request;
  event.respondWith(serve(event, key));
});

async function serve(event, key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key, { ignoreSearch: true });
  const revalidation = revalidate(cache, key, cached);
  event.waitUntil(revalidation);
  if (cached) return cached;
  const fresh = await revalidation;
  return fresh ?? new Response('Hors ligne : cette ressource n’est pas encore en cache.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Va chercher la version réseau ; met le cache à jour et prévient les pages si elle a changé. */
async function revalidate(cache, key, cached) {
  let response;
  try {
    response = await fetch(new Request(key, { cache: 'no-cache' }));
  } catch {
    return null;
  }
  if (!response || !response.ok) return response;
  const changed = cached ? await differs(cached.clone(), response.clone()) : false;
  await cache.put(key, response.clone());
  if (changed) {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage({ type: 'updated', url: typeof key === 'string' ? key : key.url });
  }
  return response;
}

/** Deux réponses diffèrent-elles ? Par ETag ou Last-Modified quand ils existent, sinon octet par octet. */
async function differs(a, b) {
  for (const header of ['etag', 'last-modified']) {
    const ha = a.headers.get(header);
    const hb = b.headers.get(header);
    if (ha && hb) return ha !== hb;
  }
  const [ba, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  if (ba.byteLength !== bb.byteLength) return true;
  const va = new Uint8Array(ba);
  const vb = new Uint8Array(bb);
  for (let i = 0; i < va.length; i += 1) if (va[i] !== vb[i]) return true;
  return false;
}
