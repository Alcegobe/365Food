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
  it('recettes perso : nouvelle (avec ou sans base), modifier', () => {
    assert.deepEqual(parseRoute('#/recettes/nouvelle'), { name: 'recipe-new' });
    assert.deepEqual(parseRoute('#/recettes/nouvelle/'), { name: 'recipe-new' });
    assert.deepEqual(parseRoute('#/recettes/nouvelle/smash-burger-light'), { name: 'recipe-new', from: 'smash-burger-light' });
    assert.deepEqual(parseRoute('#/recettes/perso-bowl/modifier'), { name: 'recipe-edit', id: 'perso-bowl' });
    assert.deepEqual(parseRoute('#/recettes/perso-bowl/autre'), { name: 'recipe', id: 'perso-bowl' });
  });
  it('planning, avec ou sans date', () => {
    assert.deepEqual(parseRoute('#/planning'), { name: 'planner' });
    assert.deepEqual(parseRoute('#/planning/2026-09-07'), { name: 'planner', date: '2026-09-07' });
  });
  it('profil et inconnu', () => {
    assert.deepEqual(parseRoute('#/profil'), { name: 'profile' });
    assert.deepEqual(parseRoute('#/nimporte/quoi'), { name: 'today' });
  });
  it('aller-retour hash ↔ route', () => {
    for (const route of [
      { name: 'today' },
      { name: 'recipes' },
      { name: 'recipe', id: 'x y' },
      { name: 'recipe-new' },
      { name: 'recipe-new', from: 'x y' },
      { name: 'recipe-edit', id: 'perso-x' },
      { name: 'profile' },
      { name: 'planner' },
      { name: 'planner', date: '2026-09-07' },
    ]) {
      assert.deepEqual(parseRoute(routeHash(route)), route);
    }
  });
});
