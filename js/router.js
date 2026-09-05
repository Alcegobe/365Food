/**
 * Routage par fragment d'URL (#/…), pour que le bouton « retour » du téléphone fonctionne.
 */

/** Analyse un hash : '#/recettes/smash-burger' → { name: 'recipe', id: 'smash-burger' }. */
export function parseRoute(hash) {
  const path = String(hash ?? '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const [head, ...rest] = path.split('/').map((part) => decodeURIComponent(part));
  if (!head) return { name: 'today' };
  if (head === 'recettes') return rest[0] ? { name: 'recipe', id: rest[0] } : { name: 'recipes' };
  if (head === 'profil') return { name: 'profile' };
  return { name: 'today' };
}

/** Hash correspondant à une route. */
export function routeHash(route) {
  switch (route.name) {
    case 'recipes':
      return '#/recettes';
    case 'recipe':
      return `#/recettes/${encodeURIComponent(route.id)}`;
    case 'profile':
      return '#/profil';
    default:
      return '#/';
  }
}
