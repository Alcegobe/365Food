/**
 * Persistance locale (brief §3) : localStorage + export / import JSON.
 * Le « storage » est injecté (objet avec getItem / setItem / removeItem)
 * pour être testable hors navigateur.
 */
import { newProfile, validateProfile } from './profile.js';
import { formatISODate, parseDateParts } from './nutrition.js';
import { emptyPlanner, normalizePlanner } from './planner.js';
import { normalizeCustomRecipes } from './custom-recipes.js';
import { normalizeTheme } from './theme.js';

export const APP_ID = '365food';
export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = '365food.state';

/** État vide (première ouverture). */
export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, profile: null, settings: {}, planner: emptyPlanner(), recipes: [] };
}

/** Migrations successives de schéma. Chaque étape amène de N à N + 1. */
const MIGRATIONS = {
  // 0 → 1 : premier schéma versionné.
  0: (state) => ({ ...state, schemaVersion: 1 }),
  // 1 → 2 : planning (V2).
  1: (state) => ({ ...state, schemaVersion: 2, planner: state.planner ?? emptyPlanner() }),
  // 2 → 3 : recettes perso (V4).
  2: (state) => ({ ...state, schemaVersion: 3, recipes: state.recipes ?? [] }),
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Ramène un objet quelconque à un état valide au schéma courant :
 * migrations, champs manquants comblés, formes vérifiées.
 * Lève TypeError si la structure n'est pas récupérable.
 */
export function normalizeState(input) {
  if (!isPlainObject(input)) throw new TypeError('État invalide : un objet est attendu.');
  let state = {
    schemaVersion: Number.isInteger(input.schemaVersion) ? input.schemaVersion : 0,
    profile: input.profile ?? null,
    settings: isPlainObject(input.settings) ? { ...input.settings } : {},
    planner: input.planner,
    recipes: input.recipes,
  };
  while (state.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[state.schemaVersion];
    if (!step) throw new TypeError(`Aucune migration depuis le schéma ${state.schemaVersion}.`);
    state = step(state);
  }
  if (state.schemaVersion > SCHEMA_VERSION) {
    throw new TypeError(`Schéma ${state.schemaVersion} plus récent que cette version de l'application (${SCHEMA_VERSION}).`);
  }
  if (state.profile !== null) {
    if (!isPlainObject(state.profile)) throw new TypeError('Profil invalide.');
    state.profile = newProfile({ ...state.profile, weights: Array.isArray(state.profile.weights) ? state.profile.weights : [] });
  }
  state.planner = normalizePlanner(state.planner);
  state.recipes = normalizeCustomRecipes(state.recipes);
  if (state.settings.theme !== undefined) state.settings.theme = normalizeTheme(state.settings.theme);
  return state;
}

/** Charge l'état depuis le storage ; en cas d'absence ou de corruption, état vide. */
export function loadState(storage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

/** Enregistre l'état (normalisé) dans le storage. */
export function saveState(state, storage) {
  const normalized = normalizeState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

/** Efface toutes les données locales. */
export function clearState(storage) {
  storage.removeItem(STORAGE_KEY);
}

/** Sérialise l'état pour un fichier de sauvegarde (JSON indenté). */
export function exportState(state, now = new Date()) {
  const normalized = normalizeState(state);
  return JSON.stringify(
    {
      app: APP_ID,
      schemaVersion: normalized.schemaVersion,
      exportedAt: now.toISOString(),
      profile: normalized.profile,
      settings: normalized.settings,
      planner: normalized.planner,
      recipes: normalized.recipes,
    },
    null,
    2,
  );
}

/** Nom de fichier proposé pour la sauvegarde. */
export function exportFileName(now = new Date()) {
  return `${APP_ID}-sauvegarde-${formatISODate(parseDateParts(now))}.json`;
}

/**
 * Lit un fichier de sauvegarde et retourne un état prêt à être enregistré.
 * Lève une Error avec un message en français si le fichier est inutilisable.
 */
export function importState(text, today = new Date()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Fichier illisible : ce n'est pas du JSON valide.");
  }
  if (!isPlainObject(data)) throw new Error('Fichier illisible : structure inattendue.');
  if (data.app !== APP_ID) throw new Error('Ce fichier ne provient pas de 365Food.');
  if (Number.isInteger(data.schemaVersion) && data.schemaVersion > SCHEMA_VERSION) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'application : mets à jour l'application avant de l'importer.");
  }
  let state;
  try {
    state = normalizeState(data);
  } catch (err) {
    throw new Error(`Sauvegarde invalide : ${err.message}`);
  }
  if (state.profile) {
    const errors = validateProfile(state.profile, today);
    if (errors.length > 0) {
      throw new Error(`Profil invalide dans la sauvegarde : ${errors.map((e) => e.message).join(' ')}`);
    }
  }
  return state;
}
