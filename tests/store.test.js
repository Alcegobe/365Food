import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_ID,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearState,
  emptyState,
  exportFileName,
  exportState,
  importState,
  loadState,
  normalizeState,
  saveState,
} from '../js/store.js';
import { newProfile } from '../js/profile.js';
import { emptyPlanner } from '../js/planner.js';

const TODAY = new Date(2026, 8, 5);

/** Doublure de localStorage. */
class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
}

function sampleState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: newProfile({
      birthDate: '1990-01-01',
      sex: 'm',
      heightCm: 180,
      weights: [{ date: '2026-09-05', kg: 80 }],
    }),
    settings: { theme: 'auto' },
    planner: { days: { '2026-09-07': { soir: [{ id: 'a', recipeId: 'smash-burger-light', portions: 1 }] } }, shopping: {} },
    recipes: [{ id: 'perso-bowl', title: 'Bowl', category: 'matin', tags: [], servings: 1, prepMin: 5, cookMin: 0, ingredients: [{ ref: 'skyr-nature-0', qty: 200, unit: 'g' }], steps: ['Mélange.'], variants: [] }],
  };
}

describe('localStorage', () => {
  it('storage vide → état vide', () => {
    assert.deepEqual(loadState(new MemoryStorage()), emptyState());
  });
  it('aller-retour save → load', () => {
    const storage = new MemoryStorage();
    saveState(sampleState(), storage);
    assert.deepEqual(loadState(storage), sampleState());
    assert.equal(typeof storage.getItem(STORAGE_KEY), 'string');
  });
  it('contenu corrompu → état vide, sans exception', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{oops');
    assert.deepEqual(loadState(storage), emptyState());
    storage.setItem(STORAGE_KEY, '[]');
    assert.deepEqual(loadState(storage), emptyState());
  });
  it('storage inaccessible (mode privé) → état vide', () => {
    const broken = { getItem() { throw new Error('denied'); } };
    assert.deepEqual(loadState(broken), emptyState());
  });
  it('clearState efface la clé', () => {
    const storage = new MemoryStorage();
    saveState(sampleState(), storage);
    clearState(storage);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  });
});

describe('normalizeState et migrations', () => {
  it('sans schemaVersion → migré vers le schéma courant', () => {
    const state = normalizeState({ profile: null });
    assert.equal(state.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(state.settings, {});
    assert.deepEqual(state.planner, emptyPlanner());
  });
  it('schéma 1 (V0/V1) → 3 : planning vide et recettes perso vides ajoutés', () => {
    const state = normalizeState({ schemaVersion: 1, profile: null, settings: {} });
    assert.equal(state.schemaVersion, 3);
    assert.deepEqual(state.planner, emptyPlanner());
    assert.deepEqual(state.recipes, []);
  });
  it('schéma 2 (V2/V3) → 3 : les recettes perso vides sont ajoutées, le reste est intact', () => {
    const planner = { days: { '2026-09-07': { soir: [{ id: 'a', recipeId: 'x', portions: 2 }] } }, shopping: {} };
    const state = normalizeState({ schemaVersion: 2, profile: null, settings: { theme: 'dark' }, planner });
    assert.equal(state.schemaVersion, 3);
    assert.deepEqual(state.planner, planner);
    assert.deepEqual(state.recipes, []);
    assert.equal(state.settings.theme, 'dark');
  });
  it('les recettes perso invalides sont écartées, le thème inconnu ramené à « auto »', () => {
    const state = normalizeState({ schemaVersion: 3, profile: null, settings: { theme: 'sépia' }, recipes: [{ id: 'perso-ok', title: 'Ok', servings: 1 }, { title: 'sans id' }, 42] });
    assert.deepEqual(state.recipes.map((r) => r.id), ['perso-ok']);
    assert.equal(state.settings.theme, 'auto');
  });
  it('un planning corrompu est nettoyé, pas fatal', () => {
    const state = normalizeState({ schemaVersion: 2, profile: null, settings: {}, planner: { days: { nope: 1 } } });
    assert.deepEqual(state.planner, emptyPlanner());
  });
  it('complète les champs manquants du profil avec les valeurs par défaut', () => {
    const state = normalizeState({ schemaVersion: 1, profile: { birthDate: '1990-01-01', sex: 'f', heightCm: 165 } });
    assert.equal(state.profile.activity, 1.55);
    assert.equal(state.profile.goal, 'loss');
    assert.equal(state.profile.weighInEveryDays, 14);
    assert.equal(state.profile.proteinPerKg, null);
    assert.equal(state.profile.name, '');
    assert.deepEqual(state.profile.weights, []);
    assert.equal(state.profile.sex, 'f');
  });
  it('rejette ce qui n’est pas un objet', () => {
    assert.throws(() => normalizeState(null), TypeError);
    assert.throws(() => normalizeState([]), TypeError);
    assert.throws(() => normalizeState({ profile: 'x' }), TypeError);
  });
  it('rejette un schéma plus récent', () => {
    assert.throws(() => normalizeState({ schemaVersion: SCHEMA_VERSION + 1 }), TypeError);
  });
});

describe('export / import JSON', () => {
  it('l’export est un JSON identifié, versionné et daté', () => {
    const data = JSON.parse(exportState(sampleState(), TODAY));
    assert.equal(data.app, APP_ID);
    assert.equal(data.schemaVersion, SCHEMA_VERSION);
    assert.equal(data.exportedAt, TODAY.toISOString());
    assert.deepEqual(data.profile, sampleState().profile);
    assert.deepEqual(data.settings, { theme: 'auto' });
    assert.deepEqual(data.planner, sampleState().planner);
  });
  it('nom de fichier daté', () => {
    assert.equal(exportFileName(TODAY), '365food-sauvegarde-2026-09-05.json');
  });
  it('import d’un export → même état', () => {
    const state = importState(exportState(sampleState(), TODAY), TODAY);
    assert.deepEqual(state, sampleState());
  });
  it('export d’un état vide puis import', () => {
    assert.deepEqual(importState(exportState(emptyState(), TODAY), TODAY), emptyState());
  });
  it('JSON illisible', () => {
    assert.throws(() => importState('pas du json', TODAY), /JSON/);
    assert.throws(() => importState('42', TODAY), /structure/);
  });
  it('fichier d’une autre application', () => {
    assert.throws(() => importState(JSON.stringify({ app: 'autre', profile: null }), TODAY), /365Food/);
  });
  it('sauvegarde d’une version plus récente', () => {
    assert.throws(() => importState(JSON.stringify({ app: APP_ID, schemaVersion: 99, profile: null }), TODAY), /plus récente/);
  });
  it('sauvegarde V1 (schéma 1) importée dans la version courante', () => {
    const state = importState(JSON.stringify({ app: APP_ID, schemaVersion: 1, profile: null, settings: {} }), TODAY);
    assert.equal(state.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(state.planner, emptyPlanner());
    assert.deepEqual(state.recipes, []);
  });
  it('les recettes perso font partie de la sauvegarde', () => {
    const data = JSON.parse(exportState(sampleState(), TODAY));
    assert.deepEqual(data.recipes, sampleState().recipes);
    assert.deepEqual(importState(exportState(sampleState(), TODAY), TODAY).recipes, sampleState().recipes);
  });
  it('profil invalide dans la sauvegarde : message explicite', () => {
    const bad = { app: APP_ID, schemaVersion: 1, profile: { birthDate: 'hier', sex: 'm', heightCm: 180, weights: [{ date: '2026-09-05', kg: 80 }] } };
    assert.throws(() => importState(JSON.stringify(bad), TODAY), /Date de naissance invalide/);
  });
  it('les données inconnues (autres versions mineures) sont ignorées, pas fatales', () => {
    const data = { app: APP_ID, schemaVersion: 1, profile: null, settings: {}, futureField: true };
    assert.deepEqual(importState(JSON.stringify(data), TODAY), emptyState());
  });
});
