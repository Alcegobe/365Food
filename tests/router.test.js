import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseRoute, routeHash } from '../js/router.js';

describe('routes', () => {
  it('accueil', () => {
    assert.deepEqual(parseRoute(''), { name: 'today' });
    assert.deepEqual(parseRoute('#'), { name: 'today' });
    assert.deepEqual(parseRoute('#/'), { name: 'today' });
  });
  it('recettes et fiche', () => {
    assert.deepEqual(parseRoute('#/recettes'), { name: 'recipes' });
    assert.deepEqual(parseRoute('#/recettes/'), { name: 'recipes' });
    assert.deepEqual(parseRoute('#/recettes/smash-burger-light'), { name: 'recipe', id: 'smash-burger-light' });
    assert.deepEqual(parseRoute('#/recettes/a%20b'), { name: 'recipe', id: 'a b' });
  });
  it('profil et inconnu', () => {
    assert.deepEqual(parseRoute('#/profil'), { name: 'profile' });
    assert.deepEqual(parseRoute('#/nimporte/quoi'), { name: 'today' });
  });
  it('aller-retour hash ↔ route', () => {
    for (const route of [{ name: 'today' }, { name: 'recipes' }, { name: 'recipe', id: 'x y' }, { name: 'profile' }]) {
      assert.deepEqual(parseRoute(routeHash(route)), route);
    }
  });
});
