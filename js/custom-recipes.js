/**
 * Recettes personnelles (brief §2.4, V4) : identifiants, normalisation pour le stockage,
 * résolution des ingrédients par nom, construction depuis le formulaire, validation.
 * Fonctions pures, sans DOM. Les macros et les points d'une recette perso sont calculés
 * comme pour le catalogue (recipes.js), jamais saisis, sauf « macros à la main » (nutritionOverride).
 */
import { CUSTOM_RECIPE_LIMITS, CUSTOM_RECIPE_PREFIX, RECIPE_CATEGORIES, RECIPE_TAGS, RECIPE_UNITS } from './config.js';
import { normalizeText } from './recipes.js';

const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber'];
const RECIPE_FIELD_ORDER = ['title', 'category', 'tags', 'servings', 'prepMin', 'cookMin', 'ingredients', 'nutritionOverride', 'steps'];
const EMPTY_INGREDIENTS_MESSAGE = 'Ajoute au moins un ingrédient, ou saisis les macros à la main.';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, max = CUSTOM_RECIPE_LIMITS.textMaxLength) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim())
    .slice(0, max);
}

/** Nombre depuis une saisie (virgule acceptée) : null si vide, NaN si illisible. */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Texte « une entrée par ligne » → liste (numéros et puces en tête de ligne retirés). */
function splitLines(value, max) {
  if (Array.isArray(value)) return cleanList(value, max);
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+\s*[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Pliage pour comparer des noms : sans accents ni casse, œ → oe. */
function fold(text) {
  return normalizeText(text).replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/\s+/g, ' ').trim();
}

/* ---------- Identifiants ---------- */

export function slugify(text) {
  return fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isCustomId(id) {
  return typeof id === 'string' && id.startsWith(CUSTOM_RECIPE_PREFIX);
}

/** Identifiant libre pour un titre : « perso-<slug> », suffixé -2, -3… s'il est déjà pris. */
export function newRecipeId(title, existingIds = []) {
  const taken = new Set(existingIds);
  const base = `${CUSTOM_RECIPE_PREFIX}${slugify(title) || 'recette'}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/* ---------- Stockage ---------- */

/**
 * Ramène une liste quelconque (stockage, import) à des recettes de forme sûre : champs connus,
 * types corrigés, entrées sans id, sans titre ou sans portions ignorées, ids dédoublonnés.
 * La validation complète (catégorie, ingrédients…) se fait avec validateRecipe.
 */
export function normalizeCustomRecipes(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id.trim()) continue;
    const id = raw.id.trim();
    const title = cleanString(raw.title, CUSTOM_RECIPE_LIMITS.titleMaxLength);
    const servings = toNumber(raw.servings);
    if (seen.has(id) || !title || !Number.isInteger(servings) || servings < 1) continue;
    seen.add(id);
    const recipe = {
      id,
      title,
      category: typeof raw.category === 'string' ? raw.category : '',
      tags: [...new Set(cleanList(raw.tags, 20))],
      servings,
      prepMin: toNumber(raw.prepMin) || 0,
      cookMin: toNumber(raw.cookMin) || 0,
      ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : [])
        .filter((line) => isObject(line) && typeof line.ref === 'string' && line.ref)
        .slice(0, CUSTOM_RECIPE_LIMITS.maxIngredients)
        .map((line) => {
          const clean = { ref: line.ref, qty: toNumber(line.qty) ?? NaN, unit: typeof line.unit === 'string' ? line.unit : 'g' };
          const label = cleanString(line.label, 120);
          if (label) clean.label = label;
          return clean;
        }),
      steps: cleanList(raw.steps, CUSTOM_RECIPE_LIMITS.maxSteps),
      variants: cleanList(raw.variants, CUSTOM_RECIPE_LIMITS.maxVariants),
    };
    for (const key of ['portionNote', 'whyLight', 'leftoverTip', 'image']) {
      const text = cleanString(raw[key]);
      if (text) recipe[key] = text;
    }
    if (isObject(raw.nutritionOverride)) {
      const override = {};
      for (const key of NUTRIENT_KEYS) {
        const n = toNumber(raw.nutritionOverride[key]);
        if (n !== null && !Number.isNaN(n)) override[key] = n;
      }
      if (Object.keys(override).length) recipe.nutritionOverride = override;
    }
    out.push(recipe);
  }
  return out;
}

/** Remplace la recette de même id, ou l'ajoute en fin de liste. Retourne une nouvelle liste. */
export function upsertRecipe(list, recipe) {
  const index = list.findIndex((entry) => entry.id === recipe.id);
  if (index === -1) return [...list, recipe];
  return list.map((entry, i) => (i === index ? recipe : entry));
}

export function removeRecipe(list, id) {
  return list.filter((entry) => entry.id !== id);
}

/* ---------- Ingrédients ---------- */

/**
 * Retrouve un ingrédient de la base à partir du texte saisi : id exact, nom exact
 * (sans accents ni casse), sinon l'unique ingrédient dont le nom contient le texte.
 */
export function matchIngredient(text, ingredientIndex) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  if (ingredientIndex.has(raw)) return ingredientIndex.get(raw);
  const wanted = fold(raw);
  let partial = null;
  let partialCount = 0;
  for (const item of ingredientIndex.values()) {
    const name = fold(item.name);
    if (name === wanted) return item;
    if (name.includes(wanted)) {
      partial = item;
      partialCount += 1;
    }
  }
  return partialCount === 1 ? partial : null;
}

/* ---------- Validation ---------- */

/**
 * Valide une recette perso contre la base d'ingrédients.
 * Retourne [{ field, message }] ; champs : title, category, tags, servings, prepMin, cookMin,
 * ingredients, nutritionOverride, steps. Vide si la recette est valide.
 */
export function validateRecipe(recipe, ingredientIndex) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  if (!isObject(recipe)) return [{ field: 'title', message: 'Recette absente.' }];
  const L = CUSTOM_RECIPE_LIMITS;

  if (typeof recipe.title !== 'string' || !recipe.title.trim()) push('title', 'Donne un titre à la recette.');
  else if (recipe.title.length > L.titleMaxLength) push('title', `Le titre ne doit pas dépasser ${L.titleMaxLength} caractères.`);

  if (!RECIPE_CATEGORIES[recipe.category]) push('category', 'Choisis une catégorie.');

  const badTag = (recipe.tags ?? []).find((tag) => !RECIPE_TAGS[tag]);
  if (badTag !== undefined) push('tags', `Tag inconnu « ${badTag} ».`);

  if (!Number.isInteger(recipe.servings) || recipe.servings < L.servings.min || recipe.servings > L.servings.max) {
    push('servings', `Portions : de ${L.servings.min} à ${L.servings.max}.`);
  }
  for (const key of ['prepMin', 'cookMin']) {
    const value = recipe[key];
    if (!Number.isInteger(value) || value < L.minutes.min || value > L.minutes.max) {
      push(key, `${key === 'prepMin' ? 'Préparation' : 'Cuisson'} : de ${L.minutes.min} à ${L.minutes.max} minutes.`);
    }
  }

  const lines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const manual = recipe.nutritionOverride;
  if (manual) {
    if (!isObject(manual)) push('nutritionOverride', 'Macros à la main invalides.');
    else {
      const bad = NUTRIENT_KEYS.find((key) => {
        const value = manual[key] ?? (key === 'fiber' ? 0 : NaN);
        const max = key === 'kcal' ? L.manual.kcalMax : L.manual.gramsMax;
        return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max;
      });
      if (bad) push('nutritionOverride', `Macros à la main : énergie de 0 à ${L.manual.kcalMax} kcal, protéines, lipides, glucides et fibres de 0 à ${L.manual.gramsMax} g.`);
    }
  } else if (lines.length === 0) {
    push('ingredients', EMPTY_INGREDIENTS_MESSAGE);
  }
  if (lines.length > L.maxIngredients) push('ingredients', `${L.maxIngredients} ingrédients au maximum.`);
  lines.forEach((line, i) => {
    const n = i + 1;
    if (!isObject(line)) {
      push('ingredients', `Ligne ${n} : ingrédient invalide.`);
      return;
    }
    const item = ingredientIndex.get(line.ref);
    if (!item) {
      push('ingredients', `Ligne ${n} : ingrédient inconnu « ${line.ref} ».`);
      return;
    }
    if (!RECIPE_UNITS.includes(line.unit)) {
      push('ingredients', `Ligne ${n} : unité inconnue.`);
      return;
    }
    if (typeof line.qty !== 'number' || !(line.qty > 0) || line.qty > L.qtyMax) {
      push('ingredients', `Ligne ${n} (${item.name}) : indique une quantité, jusqu'à ${L.qtyMax}.`);
      return;
    }
    if (line.unit === 'pce' && !item.piece?.grams) {
      push('ingredients', `Ligne ${n} : « ${item.name} » n'a pas de poids par pièce, indique des grammes.`);
    }
  });

  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) push('steps', 'Décris au moins une étape.');
  else if (recipe.steps.length > L.maxSteps) push('steps', `${L.maxSteps} étapes au maximum.`);

  return errors.sort((a, b) => RECIPE_FIELD_ORDER.indexOf(a.field) - RECIPE_FIELD_ORDER.indexOf(b.field));
}

/* ---------- Formulaire ---------- */

/**
 * Construit une recette à partir des valeurs brutes du formulaire (chaînes) :
 * { title, category, tags[], servings, prepMin, cookMin, portionNote,
 *   ingredients: [{ name, qty, unit, label?, ref? }], steps (une par ligne), whyLight, leftoverTip,
 *   variants (une par ligne), manual: { kcal, protein, fat, carbs, fiber } }.
 * Les ingrédients sont résolus par nom dans la base ; une ligne vide est ignorée ; `label` n'est
 * gardé que si l'ingrédient d'origine (`ref`) est inchangé. Les macros à la main ne sont retenues
 * que si au moins une valeur est saisie. Retourne { recipe, errors } (errors vide = valide).
 */
export function buildRecipe(input, ingredientIndex, { id } = {}) {
  const src = isObject(input) ? input : {};
  const errors = [];
  const recipe = {
    id: id ?? newRecipeId(src.title),
    title: cleanString(src.title, CUSTOM_RECIPE_LIMITS.titleMaxLength),
    category: typeof src.category === 'string' ? src.category : '',
    tags: [...new Set(cleanList(src.tags, 20))],
    servings: toNumber(src.servings) ?? NaN,
    prepMin: toNumber(src.prepMin) ?? 0,
    cookMin: toNumber(src.cookMin) ?? 0,
    ingredients: [],
    steps: splitLines(src.steps, CUSTOM_RECIPE_LIMITS.maxSteps + 1),
    variants: splitLines(src.variants, CUSTOM_RECIPE_LIMITS.maxVariants),
  };
  for (const key of ['portionNote', 'whyLight', 'leftoverTip']) {
    const text = cleanString(src[key]);
    if (text) recipe[key] = text;
  }

  (Array.isArray(src.ingredients) ? src.ingredients : []).forEach((row, i) => {
    if (!isObject(row)) return;
    const name = cleanString(row.name, 120);
    const qty = toNumber(row.qty);
    if (!name && qty === null) return;
    const item = matchIngredient(name, ingredientIndex);
    if (!item) {
      errors.push({ field: 'ingredients', message: name ? `Ligne ${i + 1} : ingrédient inconnu « ${name} », choisis-le dans la liste.` : `Ligne ${i + 1} : choisis un ingrédient.` });
      return;
    }
    const line = { ref: item.id, qty: qty ?? NaN, unit: RECIPE_UNITS.includes(row.unit) ? row.unit : 'g' };
    const label = cleanString(row.label, 120);
    if (label && row.ref === item.id) line.label = label;
    recipe.ingredients.push(line);
  });

  const manual = isObject(src.manual) ? src.manual : {};
  const values = NUTRIENT_KEYS.map((key) => [key, toNumber(manual[key])]);
  if (values.some(([, value]) => value !== null)) {
    recipe.nutritionOverride = Object.fromEntries(values.map(([key, value]) => [key, value ?? (key === 'fiber' ? 0 : NaN)]));
  }

  const rowErrors = errors.length > 0;
  for (const error of validateRecipe(recipe, ingredientIndex)) {
    // Des lignes en erreur expliquent déjà pourquoi la liste est vide.
    if (rowErrors && error.message === EMPTY_INGREDIENTS_MESSAGE) continue;
    if (!errors.some((e) => e.field === error.field && e.message === error.message)) errors.push(error);
  }
  errors.sort((a, b) => RECIPE_FIELD_ORDER.indexOf(a.field) - RECIPE_FIELD_ORDER.indexOf(b.field));
  return { recipe, errors };
}

/** Valeurs de formulaire (chaînes) pour pré-remplir l'édition d'une recette : l'inverse de buildRecipe. */
export function recipeFormValues(recipe, ingredientIndex) {
  const r = isObject(recipe) ? recipe : {};
  const override = isObject(r.nutritionOverride) ? r.nutritionOverride : {};
  const text = (value) => (value === null || value === undefined || Number.isNaN(value) ? '' : String(value));
  return {
    title: r.title ?? '',
    category: r.category ?? '',
    tags: [...(r.tags ?? [])],
    servings: text(r.servings),
    prepMin: text(r.prepMin ?? 0),
    cookMin: text(r.cookMin ?? 0),
    portionNote: r.portionNote ?? '',
    ingredients: (r.ingredients ?? []).map((line) => ({
      name: ingredientIndex.get(line.ref)?.name ?? line.ref,
      qty: text(line.qty),
      unit: line.unit ?? 'g',
      label: line.label ?? '',
      ref: line.ref,
    })),
    steps: (r.steps ?? []).join('\n'),
    whyLight: r.whyLight ?? '',
    leftoverTip: r.leftoverTip ?? '',
    variants: (r.variants ?? []).join('\n'),
    manual: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, text(override[key])])),
  };
}
