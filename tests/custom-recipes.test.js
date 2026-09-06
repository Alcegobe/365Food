import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRecipe,
  isCustomId,
  matchIngredient,
  newRecipeId,
  normalizeCustomRecipes,
  recipeFormValues,
  removeRecipe,
  slugify,
  upsertRecipe,
  validateRecipe,
} from '../js/custom-recipes.js';
import { buildCatalog, emptyFilters, filterRecipes, indexIngredients, recipeNutrition } from '../js/recipes.js';
import { CUSTOM_RECIPE_LIMITS } from '../js/config.js';

const INGREDIENTS = {
  aisles: { cremerie: 'Crémerie & œufs', epicerie: 'Épicerie', boulangerie: 'Boulangerie', 'fruits-legumes': 'Fruits & légumes' },
  items: [
    { id: 'skyr-nature-0', name: 'Skyr nature 0 %', aisle: 'cremerie', per100g: { kcal: 60, protein: 10, fat: 0, carbs: 4, fiber: 0, salt: 0.1, sugars: 4 } },
    { id: 'skyr-vanille', name: 'Skyr vanille', aisle: 'cremerie', per100g: { kcal: 70, protein: 9, fat: 0, carbs: 8, fiber: 0, salt: 0.1, sugars: 8 } },
    { id: 'oeuf', name: 'Œuf', aisle: 'cremerie', per100g: { kcal: 140, protein: 12.7, fat: 9.8, carbs: 0.3, fiber: 0, salt: 0.3, sugars: 0.3 }, piece: { grams: 55, name: 'œuf' } },
    { id: 'lait', name: 'Lait demi-écrémé', aisle: 'cremerie', per100g: { kcal: 46, protein: 3.3, fat: 1.5, carbs: 4.8, fiber: 0, salt: 0.1, sugars: 4.8 }, gPerMl: 1.03 },
    { id: 'pain', name: 'Pain burger complet', aisle: 'boulangerie', per100g: { kcal: 250, protein: 10, fat: 5, carbs: 40, fiber: 10, salt: 1, sugars: 5 }, piece: { grams: 60, name: 'pain' } },
    { id: 'banane', name: 'Banane', aisle: 'fruits-legumes', per100g: { kcal: 90, protein: 1, fat: 0.3, carbs: 20, fiber: 2.6, salt: 0, sugars: 17 }, piece: { grams: 120, name: 'banane' } },
  ],
};
const index = indexIngredients(INGREDIENTS);

/** Valeurs brutes d'un formulaire rempli correctement. */
function formInput(overrides = {}) {
  return {
    title: 'Bowl skyr banane',
    category: 'matin',
    tags: ['haute-proteine', 'sans-cuisson'],
    servings: '1',
    prepMin: '5',
    cookMin: '0',
    portionNote: '',
    ingredients: [
      { name: 'Skyr nature 0 %', qty: '200', unit: 'g' },
      { name: 'banane', qty: '1', unit: 'pce' },
      { name: '', qty: '', unit: 'g' },
    ],
    steps: '1. Verse le skyr.\n2) Coupe la banane.\n- Mélange.',
    whyLight: 'Skyr 0 %.',
    leftoverTip: '',
    variants: 'Avec du cacao.\n\nAvec des noix.',
    manual: { kcal: '', protein: '', fat: '', carbs: '', fiber: '' },
    ...overrides,
  };
}

describe('identifiants des recettes perso', () => {
  it('slug sans accents ni ponctuation', () => {
    assert.equal(slugify('Œufs brouillés « façon diner » !'), 'oeufs-brouilles-facon-diner');
    assert.equal(slugify('   '), '');
  });
  it('préfixe perso-, suffixe si déjà pris', () => {
    assert.equal(newRecipeId('Bowl skyr'), 'perso-bowl-skyr');
    assert.equal(newRecipeId('Bowl skyr', ['perso-bowl-skyr']), 'perso-bowl-skyr-2');
    assert.equal(newRecipeId('Bowl skyr', ['perso-bowl-skyr', 'perso-bowl-skyr-2']), 'perso-bowl-skyr-3');
    assert.equal(newRecipeId('???'), 'perso-recette');
    assert.ok(isCustomId('perso-x'));
    assert.ok(!isCustomId('smash-burger-light'));
  });
});

describe('résolution des ingrédients par nom', () => {
  it('id exact, nom exact sans accents ni casse, œ → oe', () => {
    assert.equal(matchIngredient('oeuf', index)?.id, 'oeuf');
    assert.equal(matchIngredient('ŒUF ', index)?.id, 'oeuf');
    assert.equal(matchIngredient('skyr-vanille', index)?.id, 'skyr-vanille');
    assert.equal(matchIngredient('lait demi-ecreme', index)?.id, 'lait');
  });
  it('un seul nom contenant le texte → trouvé, plusieurs → null, vide → null', () => {
    assert.equal(matchIngredient('vanille', index)?.id, 'skyr-vanille');
    assert.equal(matchIngredient('skyr', index), null);
    assert.equal(matchIngredient('', index), null);
    assert.equal(matchIngredient('caviar', index), null);
  });
});

describe('construction depuis le formulaire', () => {
  it('résout les ingrédients, ignore la ligne vide, découpe étapes et variantes', () => {
    const { recipe, errors } = buildRecipe(formInput(), index, { id: 'perso-bowl' });
    assert.deepEqual(errors, []);
    assert.equal(recipe.id, 'perso-bowl');
    assert.deepEqual(recipe.ingredients, [
      { ref: 'skyr-nature-0', qty: 200, unit: 'g' },
      { ref: 'banane', qty: 1, unit: 'pce' },
    ]);
    assert.deepEqual(recipe.steps, ['Verse le skyr.', 'Coupe la banane.', 'Mélange.']);
    assert.deepEqual(recipe.variants, ['Avec du cacao.', 'Avec des noix.']);
    assert.equal(recipe.servings, 1);
    assert.equal(recipe.whyLight, 'Skyr 0 %.');
    assert.equal(recipe.leftoverTip, undefined);
    assert.equal(recipe.nutritionOverride, undefined);
    assert.deepEqual(recipe.tags, ['haute-proteine', 'sans-cuisson']);
  });
  it('les macros se calculent comme pour le catalogue', () => {
    const { recipe } = buildRecipe(formInput(), index, { id: 'perso-bowl' });
    const n = recipeNutrition(recipe, index);
    // 200 g skyr : 120 kcal, P 20 | banane 120 g : 108 kcal, P 1,2, fibres 3,12
    assert.equal(n.perPortion.kcal, 228);
    assert.equal(n.perPortion.protein, 21.2);
    assert.equal(n.points, 2.5); // 4,56 − 2,12 = 2,44 → 2,5
  });
  it('id par défaut dérivé du titre, virgule décimale acceptée', () => {
    const { recipe, errors } = buildRecipe(formInput({ ingredients: [{ name: 'lait', qty: '150,5', unit: 'ml' }] }), index);
    assert.deepEqual(errors, []);
    assert.equal(recipe.id, 'perso-bowl-skyr-banane');
    assert.equal(recipe.ingredients[0].qty, 150.5);
  });
  it('libellé conservé seulement si l’ingrédient d’origine est inchangé', () => {
    const rows = [
      { name: 'Skyr nature 0 %', qty: '100', unit: 'g', label: 'skyr bien froid', ref: 'skyr-nature-0' },
      { name: 'Skyr vanille', qty: '100', unit: 'g', label: 'ancien libellé', ref: 'skyr-nature-0' },
    ];
    const { recipe } = buildRecipe(formInput({ ingredients: rows }), index);
    assert.equal(recipe.ingredients[0].label, 'skyr bien froid');
    assert.equal(recipe.ingredients[1].label, undefined);
  });
  it('signale les ingrédients inconnus ou ambigus avec leur numéro de ligne', () => {
    const { errors } = buildRecipe(formInput({ ingredients: [{ name: 'skyr', qty: '100', unit: 'g' }, { name: 'caviar', qty: '10', unit: 'g' }, { name: '', qty: '5', unit: 'g' }] }), index);
    assert.deepEqual(errors.map((e) => e.field), ['ingredients', 'ingredients', 'ingredients']);
    assert.match(errors[0].message, /Ligne 1 : ingrédient inconnu « skyr »/);
    assert.match(errors[1].message, /Ligne 2 : ingrédient inconnu « caviar »/);
    assert.match(errors[2].message, /Ligne 3 : choisis un ingrédient/);
  });
  it('macros à la main : retenues dès qu’une valeur est saisie, ingrédients facultatifs', () => {
    const { recipe, errors } = buildRecipe(formInput({ ingredients: [], manual: { kcal: '650', protein: '35', fat: '30', carbs: '55', fiber: '' } }), index);
    assert.deepEqual(errors, []);
    assert.deepEqual(recipe.nutritionOverride, { kcal: 650, protein: 35, fat: 30, carbs: 55, fiber: 0 });
    assert.equal(recipeNutrition(recipe, index).points, 9.5); // 13 − 3,5
  });
  it('macros à la main incomplètes ou hors bornes → erreur', () => {
    const { errors } = buildRecipe(formInput({ manual: { kcal: '650', protein: '', fat: '', carbs: '', fiber: '' } }), index);
    assert.deepEqual(errors.map((e) => e.field), ['nutritionOverride']);
    const over = buildRecipe(formInput({ manual: { kcal: '9000', protein: '1', fat: '1', carbs: '1', fiber: '0' } }), index);
    assert.deepEqual(over.errors.map((e) => e.field), ['nutritionOverride']);
  });
  it('erreurs de champs, triées dans l’ordre du formulaire', () => {
    const { errors } = buildRecipe(
      formInput({ title: '  ', category: 'brunch', servings: '0', prepMin: '-1', cookMin: '999', ingredients: [], steps: '', tags: ['bio'] }),
      index,
    );
    assert.deepEqual(errors.map((e) => e.field), ['title', 'category', 'tags', 'servings', 'prepMin', 'cookMin', 'ingredients', 'steps']);
  });
  it('aller-retour recette → valeurs de formulaire → recette', () => {
    const { recipe } = buildRecipe(formInput({ ingredients: [{ name: 'Skyr nature 0 %', qty: '100', unit: 'g', label: 'skyr froid', ref: 'skyr-nature-0' }] }), index, { id: 'perso-x' });
    const values = recipeFormValues(recipe, index);
    assert.equal(values.ingredients[0].name, 'Skyr nature 0 %');
    assert.equal(values.ingredients[0].label, 'skyr froid');
    assert.equal(values.steps, 'Verse le skyr.\nCoupe la banane.\nMélange.');
    const again = buildRecipe(values, index, { id: 'perso-x' });
    assert.deepEqual(again.errors, []);
    assert.deepEqual(again.recipe, recipe);
  });
});

describe('validation d’une recette perso', () => {
  const valid = () => buildRecipe(formInput(), index, { id: 'perso-bowl' }).recipe;

  it('recette valide → aucune erreur', () => {
    assert.deepEqual(validateRecipe(valid(), index), []);
  });
  it('pièce sans poids, quantité nulle, unité inconnue, trop d’ingrédients', () => {
    const r = valid();
    r.ingredients = [
      { ref: 'skyr-nature-0', qty: 1, unit: 'pce' },
      { ref: 'lait', qty: 0, unit: 'ml' },
      { ref: 'oeuf', qty: 1, unit: 'tasse' },
      { ref: 'inconnu', qty: 1, unit: 'g' },
    ];
    const messages = validateRecipe(r, index).map((e) => e.message);
    assert.equal(messages.length, 4);
    assert.match(messages[0], /Ligne 1 : « Skyr nature 0 % » n'a pas de poids par pièce/);
    assert.match(messages[1], /Ligne 2 \(Lait demi-écrémé\) : indique une quantité/);
    assert.match(messages[2], /Ligne 3 : unité inconnue/);
    assert.match(messages[3], /Ligne 4 : ingrédient inconnu « inconnu »/);
    r.ingredients = Array.from({ length: CUSTOM_RECIPE_LIMITS.maxIngredients + 1 }, () => ({ ref: 'lait', qty: 10, unit: 'ml' }));
    assert.ok(validateRecipe(r, index).some((e) => /au maximum/.test(e.message)));
  });
  it('titre trop long, étapes absentes ou trop nombreuses', () => {
    const r = valid();
    r.title = 'x'.repeat(CUSTOM_RECIPE_LIMITS.titleMaxLength + 1);
    r.steps = [];
    assert.deepEqual(validateRecipe(r, index).map((e) => e.field), ['title', 'steps']);
    r.title = 'ok';
    r.steps = Array.from({ length: CUSTOM_RECIPE_LIMITS.maxSteps + 1 }, () => 'étape');
    assert.deepEqual(validateRecipe(r, index).map((e) => e.field), ['steps']);
  });
  it('objet absent', () => {
    assert.equal(validateRecipe(null, index).length, 1);
  });
});

describe('normalisation pour le stockage', () => {
  it('garde les champs connus, corrige les types, ignore le reste', () => {
    const list = normalizeCustomRecipes([
      { id: 'perso-a', title: '  Bowl  ', category: 'matin', tags: ['x', 'x'], servings: '2', prepMin: '5', ingredients: [{ ref: 'lait', qty: '100', unit: 'ml', label: '' }, 'oups', { qty: 1 }], steps: ['a', '', 'b'], variants: 'non', whyLight: ' léger ', nutritionOverride: { kcal: '500', protein: 40, fat: 'x' }, extra: true },
      { id: 'perso-a', title: 'Doublon' },
      { id: '', title: 'Sans id', servings: 1 },
      { id: 'perso-b', title: '', servings: 1 },
      { id: 'perso-c', title: 'Sans portions' },
      null,
      'texte',
    ]);
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], {
      id: 'perso-a',
      title: 'Bowl',
      category: 'matin',
      tags: ['x'],
      servings: 2,
      prepMin: 5,
      cookMin: 0,
      ingredients: [{ ref: 'lait', qty: 100, unit: 'ml' }],
      steps: ['a', 'b'],
      variants: [],
      whyLight: 'léger',
      nutritionOverride: { kcal: 500, protein: 40 },
    });
    assert.deepEqual(normalizeCustomRecipes('nope'), []);
    assert.deepEqual(normalizeCustomRecipes(undefined), []);
  });
  it('upsert remplace en place, remove filtre', () => {
    const a = { id: 'perso-a', title: 'A' };
    const b = { id: 'perso-b', title: 'B' };
    const list = upsertRecipe(upsertRecipe([], a), b);
    assert.deepEqual(list.map((r) => r.title), ['A', 'B']);
    assert.deepEqual(upsertRecipe(list, { id: 'perso-a', title: 'A2' }).map((r) => r.title), ['A2', 'B']);
    assert.deepEqual(removeRecipe(list, 'perso-a').map((r) => r.id), ['perso-b']);
    assert.equal(list.length, 2, 'l’original n’est pas modifié');
  });
});

describe('catalogue avec recettes perso', () => {
  const official = { recipes: [{ id: 'skyr-bowl', title: 'Bowl officiel', category: 'matin', servings: 1, prepMin: 2, cookMin: 0, ingredients: [{ ref: 'skyr-nature-0', qty: 150, unit: 'g' }], steps: ['…'] }] };
  const custom = [
    buildRecipe(formInput(), index, { id: 'perso-bowl' }).recipe,
    { id: 'skyr-bowl', title: 'Collision', category: 'matin', servings: 1, prepMin: 0, cookMin: 0, ingredients: [{ ref: 'lait', qty: 100, unit: 'ml' }], steps: ['…'] },
    { id: 'perso-casse', title: 'Cassée', category: 'matin', servings: 1, prepMin: 0, cookMin: 0, ingredients: [{ ref: 'disparu', qty: 100, unit: 'g' }], steps: ['…'] },
    { id: 'perso-cat', title: 'Catégorie ?', category: 'brunch', servings: 1, prepMin: 0, cookMin: 0, ingredients: [{ ref: 'lait', qty: 100, unit: 'ml' }], steps: ['…'] },
  ];

  it('ajoute les recettes perso valides, marquées custom, et ignore les autres', () => {
    const warn = console.warn;
    const warnings = [];
    console.warn = (message) => warnings.push(message);
    let catalog;
    try {
      catalog = buildCatalog(official, INGREDIENTS, custom);
    } finally {
      console.warn = warn;
    }
    assert.deepEqual(catalog.recipes.map((r) => r.id), ['skyr-bowl', 'perso-bowl']);
    assert.equal(catalog.recipes[0].custom, undefined);
    assert.equal(catalog.recipes[1].custom, true);
    assert.equal(custom[0].custom, undefined, 'la recette stockée n’est pas modifiée');
    assert.ok(catalog.nutritionById.has('perso-bowl'));
    assert.ok(!catalog.nutritionById.has('perso-casse'));
    assert.equal(warnings.length, 3);
    assert.equal(catalog.sources.recipesDb, official);
  });
  it('filtre « mes recettes »', () => {
    const catalog = buildCatalog(official, INGREDIENTS, [custom[0]]);
    const ids = (filters) => filterRecipes(catalog.recipes, filters, catalog.nutritionById, catalog.ingredientIndex).map((r) => r.id);
    assert.deepEqual(ids(emptyFilters()), ['skyr-bowl', 'perso-bowl']);
    assert.deepEqual(ids({ onlyCustom: true }), ['perso-bowl']);
    assert.deepEqual(ids({ onlyCustom: true, category: 'soir' }), []);
  });
});
