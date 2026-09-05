import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  emptyFilters,
  filterRecipes,
  formatQuantity,
  indexIngredients,
  ingredientGrams,
  loadCatalog,
  recipeNutrition,
  scaleRecipe,
  totalMinutes,
  validateCatalog,
} from '../js/recipes.js';

const INGREDIENTS = {
  aisles: { cremerie: 'Crémerie & œufs', epicerie: 'Épicerie', boulangerie: 'Boulangerie' },
  items: [
    { id: 'skyr', name: 'Skyr', aisle: 'cremerie', per100g: { kcal: 60, protein: 10, fat: 0, carbs: 4, fiber: 0, salt: 0.1, sugars: 4 } },
    { id: 'lait', name: 'Lait', aisle: 'cremerie', per100g: { kcal: 50, protein: 3, fat: 2, carbs: 5, fiber: 0, salt: 0.1, sugars: 5 }, gPerMl: 1.03 },
    { id: 'pain', name: 'Pain', aisle: 'boulangerie', per100g: { kcal: 250, protein: 10, fat: 5, carbs: 40, fiber: 10, salt: 1, sugars: 5 }, piece: { grams: 60, name: 'pain' } },
    { id: 'miel', name: 'Miel', aisle: 'epicerie', per100g: { kcal: 300, protein: 0, fat: 0, carbs: 80, fiber: 0, salt: 0, sugars: 80 }, addedSugar: true },
    { id: 'sans-piece', name: 'Sans poids par pièce', aisle: 'epicerie', per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0, sugars: 0 } },
  ],
};

/** 2 portions : 200 g skyr + 2 pains + 100 ml lait + 40 g miel. */
const RECIPE = {
  id: 'test',
  title: 'Recette test',
  category: 'matin',
  tags: ['haute-proteine', 'express'],
  servings: 2,
  prepMin: 5,
  cookMin: 10,
  ingredients: [
    { ref: 'skyr', qty: 200, unit: 'g' },
    { ref: 'pain', qty: 2, unit: 'pce' },
    { ref: 'lait', qty: 100, unit: 'ml' },
    { ref: 'miel', qty: 40, unit: 'g', label: 'miel liquide' },
  ],
  steps: ['Mélanger.'],
};

const index = indexIngredients(INGREDIENTS);

describe('grammes par ligne', () => {
  it('g, ml (densité) et pièces', () => {
    assert.equal(ingredientGrams({ ref: 'skyr', qty: 200, unit: 'g' }, index.get('skyr')), 200);
    assert.equal(ingredientGrams({ ref: 'lait', qty: 100, unit: 'ml' }, index.get('lait')), 103);
    assert.equal(ingredientGrams({ ref: 'pain', qty: 2, unit: 'pce' }, index.get('pain')), 120);
  });
  it('ml sans densité connue = 1 g/ml', () => {
    assert.equal(ingredientGrams({ ref: 'skyr', qty: 50, unit: 'ml' }, index.get('skyr')), 50);
  });
  it('erreurs : ingrédient inconnu, pièce sans poids, unité inconnue, quantité invalide', () => {
    assert.throws(() => ingredientGrams({ ref: 'x', qty: 1, unit: 'g' }, undefined), /inconnu/);
    assert.throws(() => ingredientGrams({ ref: 'sans-piece', qty: 1, unit: 'pce' }, index.get('sans-piece')), /pièce/);
    assert.throws(() => ingredientGrams({ ref: 'skyr', qty: 1, unit: 'tasse' }, index.get('skyr')), /Unité/);
    assert.throws(() => ingredientGrams({ ref: 'skyr', qty: -1, unit: 'g' }, index.get('skyr')), /Quantité/);
  });
});

describe('macros et points d’une recette (§3.1, §4.4)', () => {
  it('total = somme ingrédients × base ÷ 100, par portion = total ÷ portions', () => {
    // skyr 200 g : 120 kcal, P 20, G 8, sucres 8 | pains 120 g : 300 kcal, P 12, L 6, G 48, fibres 12, sucres 6
    // lait 103 g : 51,5 kcal, P 3,09, L 2,06, G 5,15 | miel 40 g : 120 kcal, G 32, sucres 32 (ajoutés)
    const n = recipeNutrition(RECIPE, index);
    assert.equal(n.total.kcal, 591.5);
    assert.equal(n.total.protein, 35.1);
    assert.equal(n.total.fat, 8.1);
    assert.equal(n.total.carbs, 93.2);
    assert.equal(n.total.fiber, 12);
    assert.equal(n.total.addedSugar, 32);
    assert.equal(n.perPortion.kcal, 295.8);
    assert.equal(n.perPortion.protein, 17.5);
    assert.equal(n.perPortion.fiber, 6);
    assert.equal(n.perPortion.addedSugar, 16);
  });
  it('points par portion : kcal/50 − P/10, bonus fibres ≥ 5 g, malus sucres ajoutés > 15 g', () => {
    // 295,75/50 = 5,915 − 1,755 = 4,16 − 0,5 (fibres 6 g) + 0,5 (sucres ajoutés 16 g) = 4,16 → 4
    assert.equal(recipeNutrition(RECIPE, index).points, 4);
  });
  it('sans miel : plus de malus, points 3,5', () => {
    const recipe = { ...RECIPE, ingredients: RECIPE.ingredients.filter((l) => l.ref !== 'miel') };
    // (591,5 − 120)/2 = 235,75 → 4,715 − 1,755 − 0,5 = 2,46 → 2,5
    assert.equal(recipeNutrition(recipe, index).points, 2.5);
  });
  it('nutritionOverride remplace le calcul', () => {
    const recipe = { ...RECIPE, nutritionOverride: { kcal: 500, protein: 40, fat: 10, carbs: 50, fiber: 2 } };
    const n = recipeNutrition(recipe, index);
    assert.equal(n.perPortion.kcal, 500);
    assert.equal(n.total.kcal, 1000);
    assert.equal(n.points, 6); // 10 − 4
  });
  it('portions invalides → erreur', () => {
    assert.throws(() => recipeNutrition({ ...RECIPE, servings: 0 }, index), /Portions/);
  });
});

describe('ajustement des portions', () => {
  it('multiplie les quantités, sans toucher à l’original', () => {
    const scaled = scaleRecipe(RECIPE, 3);
    assert.equal(scaled.servings, 3);
    assert.deepEqual(scaled.ingredients.map((l) => l.qty), [300, 3, 150, 60]);
    assert.equal(RECIPE.ingredients[0].qty, 200);
  });
  it('les macros par portion ne changent pas, le total oui', () => {
    const before = recipeNutrition(RECIPE, index);
    const after = recipeNutrition(scaleRecipe(RECIPE, 4), index);
    assert.equal(after.perPortion.kcal, before.perPortion.kcal);
    assert.equal(after.points, before.points);
    assert.equal(after.total.kcal, 1183);
  });
  it('portions invalides → erreur', () => {
    assert.throws(() => scaleRecipe(RECIPE, 0), RangeError);
    assert.throws(() => scaleRecipe(RECIPE, 1.5), RangeError);
  });
  it('quantités affichées : grammes entiers, décimales pour les petites quantités, pièces au pluriel', () => {
    assert.equal(formatQuantity({ qty: 200, unit: 'g' }, index.get('skyr')), '200 g');
    assert.equal(formatQuantity({ qty: 2.5, unit: 'g' }, index.get('skyr')), '2.5 g');
    assert.equal(formatQuantity({ qty: 100, unit: 'ml' }, index.get('lait')), '100 ml');
    assert.equal(formatQuantity({ qty: 1, unit: 'pce' }, index.get('pain')), '1 pain');
    assert.equal(formatQuantity({ qty: 3, unit: 'pce' }, index.get('pain')), '3 pains');
    assert.equal(formatQuantity({ qty: 1.5, unit: 'pce' }, index.get('pain'), (n) => String(n).replace('.', ',')), '1,5 pain');
  });
});

describe('filtres du catalogue (§2.4)', () => {
  const recipes = [
    RECIPE,
    { ...RECIPE, id: 'soir', title: 'Poulet rôti', category: 'soir', tags: ['batch'], prepMin: 20, cookMin: 40, ingredients: [{ ref: 'skyr', qty: 100, unit: 'g' }] },
    { ...RECIPE, id: 'sauce', title: 'Sauce au skyr', category: 'sauces', tags: ['sans-cuisson'], prepMin: 5, cookMin: 0, ingredients: [{ ref: 'skyr', qty: 100, unit: 'g' }] },
  ];
  const nutritionById = new Map(recipes.map((r) => [r.id, recipeNutrition(r, index)]));
  const ids = (filters) => filterRecipes(recipes, filters, nutritionById, index).map((r) => r.id);

  it('sans filtre : tout', () => {
    assert.deepEqual(ids(emptyFilters()), ['test', 'soir', 'sauce']);
  });
  it('catégorie', () => {
    assert.deepEqual(ids({ category: 'soir' }), ['soir']);
    assert.deepEqual(ids({ category: 'all' }), ['test', 'soir', 'sauce']);
  });
  it('points max', () => {
    assert.deepEqual(ids({ maxPoints: 2 }), ['soir', 'sauce']); // 100 g skyr = 1 point
    assert.deepEqual(ids({ maxPoints: 4 }), ['test', 'soir', 'sauce']);
  });
  it('temps max', () => {
    assert.equal(totalMinutes(recipes[1]), 60);
    assert.deepEqual(ids({ maxMinutes: 15 }), ['test', 'sauce']);
  });
  it('tags : tous requis', () => {
    assert.deepEqual(ids({ tags: ['haute-proteine'] }), ['test']);
    assert.deepEqual(ids({ tags: ['haute-proteine', 'batch'] }), []);
  });
  it('recherche sur le titre, les ingrédients et les tags, sans accents ni casse', () => {
    assert.deepEqual(ids({ query: 'POULET' }), ['soir']);
    assert.deepEqual(ids({ query: 'miel' }), ['test']);
    assert.deepEqual(ids({ query: 'roti' }), ['soir']);
    assert.deepEqual(ids({ query: 'sans cuisson' }), ['sauce']);
    assert.deepEqual(ids({ query: 'skyr' }), ['test', 'soir', 'sauce']);
    assert.deepEqual(ids({ query: 'pizza' }), []);
  });
  it('filtres combinés', () => {
    assert.deepEqual(ids({ query: 'skyr', maxMinutes: 15, category: 'sauces' }), ['sauce']);
  });
});

describe('validation des données', () => {
  it('jeu de test cohérent', () => {
    assert.deepEqual(validateCatalog({ recipes: [RECIPE] }, INGREDIENTS), []);
  });
  it('signale ingrédient inconnu, unité inconnue, catégorie et tag inconnus, pièce sans poids, id dupliqué', () => {
    const bad = {
      recipes: [
        { ...RECIPE, category: 'brunch', tags: ['bio'], ingredients: [{ ref: 'x', qty: 1, unit: 'g' }, { ref: 'skyr', qty: 1, unit: 'tasse' }, { ref: 'sans-piece', qty: 1, unit: 'pce' }] },
        { ...RECIPE },
        { ...RECIPE, id: 'vide', ingredients: [], steps: [] },
      ],
    };
    const problems = validateCatalog(bad, INGREDIENTS);
    assert.ok(problems.some((p) => /inconnu « x »/.test(p)), problems.join('\n'));
    assert.ok(problems.some((p) => /unité inconnue « tasse »/.test(p)));
    assert.ok(problems.some((p) => /catégorie inconnue « brunch »/.test(p)));
    assert.ok(problems.some((p) => /tag inconnu « bio »/.test(p)));
    assert.ok(problems.some((p) => /pièce/.test(p)));
    assert.ok(problems.some((p) => /dupliqué/.test(p)));
    assert.ok(problems.some((p) => /aucun ingrédient/.test(p)));
    assert.ok(problems.some((p) => /aucune étape/.test(p)));
  });
  it('signale un rayon inconnu ou une valeur nutritionnelle manquante', () => {
    const db = { aisles: {}, items: [{ id: 'a', aisle: 'nulle-part', per100g: { kcal: 1 } }] };
    const problems = validateCatalog({ recipes: [] }, db);
    assert.ok(problems.some((p) => /rayon inconnu/.test(p)));
    assert.ok(problems.some((p) => /« protein » manquante/.test(p)));
  });
});

describe('fichiers data/ du dépôt', () => {
  const recipesDb = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8'));
  const ingredientsDb = JSON.parse(readFileSync(new URL('../data/ingredients.json', import.meta.url), 'utf8'));

  it('sont cohérents entre eux', () => {
    assert.deepEqual(validateCatalog(recipesDb, ingredientsDb), []);
  });
  it('contiennent les trois recettes de référence de la V1, une par moment', () => {
    assert.deepEqual(
      recipesDb.recipes.map((r) => r.category).sort(),
      ['matin', 'sauces', 'soir'],
    );
  });
  it('chaque recette a une fiche complète', () => {
    for (const recipe of recipesDb.recipes) {
      assert.ok(recipe.whyLight, `${recipe.id} : whyLight`);
      assert.ok(recipe.steps.length >= 3, `${recipe.id} : étapes`);
      assert.ok(Array.isArray(recipe.variants) && recipe.variants.length > 0, `${recipe.id} : variantes`);
      assert.ok(recipe.prepMin >= 0 && recipe.cookMin >= 0, `${recipe.id} : temps`);
    }
    const soir = recipesDb.recipes.find((r) => r.category === 'soir');
    assert.equal(soir.servings, 2, 'un dîner = 2 portions (restes du midi)');
    assert.ok(soir.leftoverTip, 'note « le lendemain »');
  });
  it('donnent des macros et des points plausibles', async () => {
    const catalog = await loadCatalog({ inline: { recipes: recipesDb, ingredients: ingredientsDb } });
    assert.equal(catalog.recipes.length, 3);
    const n = (id) => catalog.nutritionById.get(id);

    const sauce = n('sauce-blanche-kebab');
    assert.ok(sauce.perPortion.kcal < 60 && sauce.points <= 1, JSON.stringify(sauce));

    const pancakes = n('pancakes-proteines-banane');
    assert.ok(pancakes.perPortion.protein >= 22 && pancakes.perPortion.kcal < 500, JSON.stringify(pancakes));
    assert.ok(pancakes.perPortion.addedSugar < 15, 'sirop d’érable sous le seuil du malus');

    const burger = n('smash-burger-light');
    assert.ok(burger.perPortion.protein >= 38, JSON.stringify(burger));
    assert.ok(burger.perPortion.kcal >= 380 && burger.perPortion.kcal <= 480, JSON.stringify(burger));
    assert.ok(burger.perPortion.fiber >= 5, 'bonus fibres');
    assert.ok(burger.points >= 3 && burger.points <= 4.5, `points burger : ${burger.points}`);
  });
});
