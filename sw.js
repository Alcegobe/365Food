/**
 * Service worker « kill switch ».
 *
 * L'ancienne application 365Food (supprimée) enregistrait un service worker à cette
 * adresse, qui mettait tout le site en cache. Ce fichier le remplace lors de la
 * vérification de mise à jour du navigateur : il vide les caches, se désinstalle et
 * recharge les pages ouvertes, pour que les anciens visiteurs voient la nouvelle app.
 * Un vrai service worker (mode hors ligne, PWA) arrivera en V4.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: 'window' });
      await self.registration.unregister();
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => undefined)));
    })(),
  );
});
