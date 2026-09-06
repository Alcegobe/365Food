/**
 * Catalogue de recettes (brief §2.4 et §3.1) : chargement, calcul des macros et des points
 * à partir de la base d'ingrédients, ajustement des portions, filtres, validation des données.
 * Fonctions pures sauf loadCatalog (fetch).
 */
import { RECIPE_CATEGORIES, RECIPE_TAGS, RECIPE_UNITS } from './config.js';
import { points } from './nutrition.js';

const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'salt', 'sugars'];

/** Index id → ingrédient à partir du fichier ingredients.json. */
export function indexIngredients(db) {
  const index = new Map();
  for (const item of db.items ?? []) index.set(item.id, item);
  return index;
}

/** Poids en grammes d'une ligne d'ingrédient (g, ml via gPerMl, pce via piece.grams). */
export function ingredientGrams(line, item) {
  if (!item) throw new RangeError(`Ingrédient inconnu : ${line.ref}`);
  const qty = Number(line.qty);
  if (!Number.isFinite(qty) || qty < 0) throw new RangeError(`Quantité invalide pour ${line.ref}`);
  switch (line.unit) {
    case 'g':
      return qty;
    case 'ml':
      return qty * (item.gPerMl ?? 1);
    case 'pce':
      if (!item.piece?.grams) throw new RangeError(`Poids par pièce inconnu pour ${line.ref}`);
      return qty * item.piece.grams;
    default:
      throw new RangeError(`Unité inconnue : ${line.unit}`);
  }
}

function emptyNutrition() {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0, sugars: 0, addedSugar: 0 };
}

export function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Macros d'une recette : total et par portion (arrondis au dixième), plus les points par portion.
 * `nutritionOverride` (par portion) remplace le calcul s'il est présent.
 */
export function recipeNutrition(recipe, ingredientIndex) {
  const servings = Number(recipe.servings);
  if (!Number.isInteger(servings) || servings < 1) throw new RangeError(`Portions invalides pour ${recipe.id}`);

  let perPortion;
  if (recipe.nutritionOverride) {
    perPortion = { ...emptyNutrition(), ...recipe.nutritionOverride };
  } else {
    const total = emptyNutrition();
    for (const line of recipe.ingredients ?? []) {
      const item = ingredientIndex.get(line.ref);
      const grams = ingredientGrams(line, item);
      for (const key of NUTRIENTS) total[key] += ((item.per100g?.[key] ?? 0) * grams) / 100;
      if (item.addedSugar) total.addedSugar += ((item.per100g?.sugars ?? 0) * grams) / 100;
    }
    perPortion = {};
    for (const key of Object.keys(total)) perPortion[key] = total[key] / servings;
  }

  const rounded = {};
  for (const key of Object.keys(perPortion)) rounded[key] = round1(perPortion[key]);
  const total = {};
  for (const key of Object.keys(rounded)) total[key] = round1(perPortion[key] * servings);

  return {
    perPortion: rounded,
    total,
    points: points({ kcal: perPortion.kcal, proteinG: perPortion.protein, fiberG: perPortion.fiber, addedSugarG: perPortion.addedSugar }),
  };
}

/** Recette avec les quantités ajustées à un autre nombre de portions. */
export function scaleRecipe(recipe, servings) {
  const target = Number(servings);
  if (!Number.isInteger(target) || target < 1) throw new RangeError('Nombre de portions invalide.');
  const factor = target / recipe.servings;
  return {
    ...recipe,
    servings: target,
    ingredients: (recipe.ingredients ?? []).map((line) => ({ ...line, qty: Math.round(line.qty * factor * 100) / 100 })),
  };
}

/** Temps total (préparation + cuisson) en minutes. */
export function totalMinutes(recipe) {
  return (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0);
}

/** Filtres vides. */
export function emptyFilters() {
  return { category: 'all', query: '', maxPoints: null, maxMinutes: null, tags: [], onlyCustom: false };
}

/** Texte sans accents ni casse, pour la recherche et la résolution des ingrédients. */
export function normalizeText(text) {
  return String(text ?? '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Applique les filtres du catalogue : catégorie, recherche (titre, tags, ingrédients),
 * points max, temps max, tags (tous requis), « mes recettes » (recettes perso seulement).
 */
export function filterRecipes(recipes, filters, nutritionById, ingredientIndex = new Map()) {
  const f = { ...emptyFilters(), ...filters };
  const query = normalizeText(f.query).trim();
  return recipes.filter((recipe) => {
    if (f.category && f.category !== 'all' && recipe.category !== f.category) return false;
    if (f.onlyCustom && !recipe.custom) return false;
    if (f.maxPoints !== null && f.maxPoints !== undefined) {
      const pts = nutritionById?.get(recipe.id)?.points;
      if (pts === undefined || pts > f.maxPoints) return false;
    }
    if (f.maxMinutes !== null && f.maxMinutes !== undefined && totalMinutes(recipe) > f.maxMinutes) return false;
    if (f.tags?.length && !f.tags.every((tag) => recipe.tags?.includes(tag))) return false;
    if (query) {
      const haystack = [
        recipe.title,
        ...(recipe.tags ?? []).map((tag) => RECIPE_TAGS[tag] ?? tag),
        ...(recipe.ingredients ?? []).map((line) => line.label ?? ingredientIndex.get(line.ref)?.name ?? line.ref),
      ]
        .map(normalizeText)
        .join(' ');
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Libellé affiché pour une ligne d'ingrédient (label de la recette, sinon nom de la base). */
export function ingredientLabel(line, item) {
  return line.label ?? item?.name ?? line.ref;
}

/** Quantité affichée : « 250 g », « 10 ml », « 2 pains », « ½ » n'est pas géré, on reste décimal. */
export function formatQuantity(line, item, format = (n) => String(n)) {
  const qty = Number(line.qty);
  if (line.unit === 'pce') {
    const name = item?.piece?.name ?? 'pièce';
    const plural = qty >= 2 && !name.endsWith('s') && !name.endsWith('x') ? `${name}s` : name;
    return `${format(qty)} ${plural}`;
  }
  const shown = line.unit === 'g' && qty >= 10 ? Math.round(qty) : Math.round(qty * 10) / 10;
  return `${format(shown)} ${line.unit}`;
}

/**
 * Vérifie la cohérence des fichiers de données. Retourne la liste des problèmes (vide si tout va bien).
 */
export function validateCatalog(recipesDb, ingredientsDb) {
  const problems = [];
  const index = indexIngredients(ingredientsDb);
  const aisles = ingredientsDb.aisles ?? {};

  for (const item of ingredientsDb.items ?? []) {
    if (!item.id) problems.push('Ingrédient sans id.');
    if (!aisles[item.aisle]) problems.push(`${item.id} : rayon inconnu « ${item.aisle} ».`);
    for (const key of NUTRIENTS) {
      const value = item.per100g?.[key];
      if (typeof value !== 'number' || value < 0) problems.push(`${item.id} : valeur « ${key} » manquante ou négative.`);
    }
  }
  const ingredientIds = (ingredientsDb.items ?? []).map((item) => item.id);
  if (new Set(ingredientIds).size !== ingredientIds.length) problems.push('Identifiants d’ingrédients dupliqués.');

  const recipeIds = new Set();
  for (const recipe of recipesDb.recipes ?? []) {
    const name = recipe.id ?? recipe.title ?? '?';
    if (!recipe.id) problems.push('Recette sans id.');
    if (recipeIds.has(recipe.id)) problems.push(`${name} : id dupliqué.`);
    recipeIds.add(recipe.id);
    if (!recipe.title) problems.push(`${name} : titre manquant.`);
    if (!RECIPE_CATEGORIES[recipe.category]) problems.push(`${name} : catégorie inconnue « ${recipe.category} ».`);
    if (!Number.isInteger(recipe.servings) || recipe.servings < 1) problems.push(`${name} : portions invalides.`);
    if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) problems.push(`${name} : aucune étape.`);
    for (const tag of recipe.tags ?? []) {
      if (!RECIPE_TAGS[tag]) problems.push(`${name} : tag inconnu « ${tag} ».`);
    }
    if (!recipe.nutritionOverride && (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0)) {
      problems.push(`${name} : aucun ingrédient.`);
    }
    for (const line of recipe.ingredients ?? []) {
      if (!RECIPE_UNITS.includes(line.unit)) problems.push(`${name} : unité inconnue « ${line.unit} » pour ${line.ref}.`);
      const item = index.get(line.ref);
      if (!item) {
        problems.push(`${name} : ingrédient inconnu « ${line.ref} ».`);
        continue;
      }
      try {
        ingredientGrams(line, item);
      } catch (err) {
        problems.push(`${name} : ${err.message}`);
      }
    }
  }
  return problems;
}

/**
 * Assemble le catalogue : recettes officielles puis recettes perso (marquées `custom: true`),
 * macros et points calculés pour chacune. Une recette perso qui ne se calcule plus (ingrédient
 * disparu, catégorie inconnue, id déjà pris) est ignorée avec un avertissement.
 * Les fichiers d'origine sont conservés dans `sources` pour reconstruire le catalogue sans réseau.
 */
export function buildCatalog(recipesDb, ingredientsDb, customRecipes = []) {
  const ingredientIndex = indexIngredients(ingredientsDb);
  const nutritionById = new Map();
  const recipes = [];
  for (const recipe of recipesDb.recipes ?? []) {
    try {
      nutritionById.set(recipe.id, recipeNutrition(recipe, ingredientIndex));
      recipes.push(recipe);
    } catch (err) {
      console.warn(`Recette ignorée (${recipe.id}) : ${err.message}`);
    }
  }
  for (const stored of customRecipes) {
    const recipe = { ...stored, custom: true };
    try {
      if (nutritionById.has(recipe.id)) throw new RangeError('id déjà utilisé');
      if (!RECIPE_CATEGORIES[recipe.category]) throw new RangeError(`catégorie inconnue « ${recipe.category} »`);
      nutritionById.set(recipe.id, recipeNutrition(recipe, ingredientIndex));
      recipes.push(recipe);
    } catch (err) {
      nutritionById.delete(recipe.id);
      console.warn(`Recette perso ignorée (${recipe.id}) : ${err.message}`);
    }
  }
  return { recipes, ingredientIndex, nutritionById, aisles: ingredientsDb.aisles ?? {}, sources: { recipesDb, ingredientsDb } };
}

/**
 * Charge les deux fichiers de données et assemble le catalogue. `inline` permet d'injecter
 * les données (tests, version « un seul fichier ») sans réseau ; `custom` : recettes perso.
 */
export async function loadCatalog({ base = 'data/', inline = globalThis.__365FOOD_DATA__, custom = [] } = {}) {
  let recipesDb;
  let ingredientsDb;
  if (inline) {
    ({ recipes: recipesDb, ingredients: ingredientsDb } = inline);
  } else {
    const [recipesRes, ingredientsRes] = await Promise.all([fetch(`${base}recipes.json`), fetch(`${base}ingredients.json`)]);
    if (!recipesRes.ok || !ingredientsRes.ok) throw new Error('Impossible de charger les recettes.');
    [recipesDb, ingredientsDb] = await Promise.all([recipesRes.json(), ingredientsRes.json()]);
  }
  return buildCatalog(recipesDb, ingredientsDb, custom);
}
