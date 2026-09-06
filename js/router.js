/**
 * Routage par fragment d'URL (#/…), pour que le bouton « retour » du téléphone fonctionne.
 */

/**
 * Analyse un hash : '#/recettes/smash-burger' → { name: 'recipe', id: 'smash-burger' }.
 * Recettes perso : '#/recettes/nouvelle[/<id de base>]' et '#/recettes/<id>/modifier'.
 */
export function parseRoute(hash) {
  const path = String(hash ?? '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const [head, ...rest] = path.split('/').map((part) => decodeURIComponent(part));
  if (!head) return { name: 'today' };
  if (head === 'recettes') {
    if (!rest[0]) return { name: 'recipes' };
    if (rest[0] === 'nouvelle') return rest[1] ? { name: 'recipe-new', from: rest[1] } : { name: 'recipe-new' };
    if (rest[1] === 'modifier') return { name: 'recipe-edit', id: rest[0] };
    return { name: 'recipe', id: rest[0] };
  }
  if (head === 'profil') return { name: 'profile' };
  if (head === 'planning') return rest[0] ? { name: 'planner', date: rest[0] } : { name: 'planner' };
  return { name: 'today' };
}

/** Hash correspondant à une route. */
export function routeHash(route) {
  switch (route.name) {
    case 'recipes':
      return '#/recettes';
    case 'recipe':
      return `#/recettes/${encodeURIComponent(route.id)}`;
    case 'recipe-new':
      return route.from ? `#/recettes/nouvelle/${encodeURIComponent(route.from)}` : '#/recettes/nouvelle';
    case 'recipe-edit':
      return `#/recettes/${encodeURIComponent(route.id)}/modifier`;
    case 'profile':
      return '#/profil';
    case 'planner':
      return route.date ? `#/planning/${encodeURIComponent(route.date)}` : '#/planning';
    default:
      return '#/';
  }
}
