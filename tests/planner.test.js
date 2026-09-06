import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  addItem,
  addLeftovers,
  cookedPortions,
  dayItems,
  dayPlan,
  dayTotals,
  emptyPlanner,
  findItem,
  leftoverCandidates,
  normalizePlanner,
  removeItem,
  setPortions,
  shoppingChecked,
  shoppingList,
  toggleShopping,
  weekDates,
  weekStart,
  weekTotals,
} from '../js/planner.js';
import { indexIngredients, recipeNutrition } from '../js/recipes.js';

/** Générateur d'identifiants prévisible. */
function ids() {
  let n = 0;
  return () => `i${(n += 1)}`;
}

const INGREDIENTS = {
  aisles: { boucherie: 'Boucherie & volaille', boulangerie: 'Boulangerie', cremerie: 'Crémerie & œufs', epicerie: 'Épicerie' },
  items: [
    { id: 'boeuf', name: 'Bœuf haché', aisle: 'boucherie', per100g: { kcal: 120, protein: 21, fat: 5, carbs: 0, fiber: 0, salt: 0.2, sugars: 0 } },
    { id: 'pain', name: 'Pain burger', aisle: 'boulangerie', per100g: { kcal: 260, protein: 9, fat: 4, carbs: 45, fiber: 6, salt: 1, sugars: 5 }, piece: { grams: 60, name: 'pain' } },
    { id: 'skyr', name: 'Skyr', aisle: 'cremerie', per100g: { kcal: 60, protein: 10, fat: 0, carbs: 4, fiber: 0, salt: 0.1, sugars: 4 } },
    { id: 'lait', name: 'Lait', aisle: 'cremerie', per100g: { kcal: 46, protein: 3.3, fat: 1.5, carbs: 4.8, fiber: 0, salt: 0.1, sugars: 4.8 }, gPerMl: 1.03 },
    { id: 'sel', name: 'Sel', aisle: 'epicerie', per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 100, sugars: 0 }, pantry: true },
  ],
};

const RECIPES = [
  {
    id: 'burger',
    title: 'Burger',
    category: 'soir',
    servings: 2,
    prepMin: 10,
    cookMin: 10,
    ingredients: [
      { ref: 'boeuf', qty: 250, unit: 'g' },
      { ref: 'pain', qty: 2, unit: 'pce' },
      { ref: 'sel', qty: 1, unit: 'g' },
    ],
    steps: ['…'],
  },
  {
    id: 'bowl',
    title: 'Bowl de skyr',
    category: 'matin',
    servings: 1,
    prepMin: 5,
    cookMin: 0,
    ingredients: [
      { ref: 'skyr', qty: 200, unit: 'g' },
      { ref: 'lait', qty: 100, unit: 'ml' },
    ],
    steps: ['…'],
  },
];

const ingredientIndex = indexIngredients(INGREDIENTS);
const nutritionById = new Map(RECIPES.map((r) => [r.id, recipeNutrition(r, ingredientIndex)]));
const catalog = { recipes: RECIPES, ingredientIndex, aisles: INGREDIENTS.aisles };

describe('dates de la semaine', () => {
  it('addDays gère les changements de mois et d’année', () => {
    assert.equal(addDays('2026-09-30', 1), '2026-10-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  });
  it('la semaine commence le lundi', () => {
    assert.equal(weekStart('2026-09-05'), '2026-08-31'); // samedi → lundi 31 août
    assert.equal(weekStart('2026-09-06'), '2026-08-31'); // dimanche → même lundi
    assert.equal(weekStart('2026-09-07'), '2026-09-07'); // lundi
    assert.deepEqual(weekDates('2026-09-09'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  });
  it('date invalide → erreur', () => {
    assert.throws(() => weekStart('hier'), RangeError);
  });
});

describe('ajout, retrait, portions', () => {
  it('ajoute une recette à un créneau sans modifier l’original', () => {
    const p0 = emptyPlanner();
    const p1 = addItem(p0, { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, ids());
    assert.deepEqual(p0.days, {});
    assert.deepEqual(p1.days['2026-09-07'].soir, [{ id: 'i1', recipeId: 'burger', portions: 1 }]);
    assert.deepEqual(dayPlan(p1, '2026-09-07').matin, []);
  });
  it('dayItems liste les items avec leur créneau', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'matin', recipeId: 'bowl' }, make);
    p = addItem(p, { date: '2026-09-07', slot: 'soir', recipeId: 'burger', portions: 2 }, make);
    assert.deepEqual(dayItems(p, '2026-09-07'), [
      { slot: 'matin', id: 'i1', recipeId: 'bowl', portions: 1 },
      { slot: 'soir', id: 'i2', recipeId: 'burger', portions: 2 },
    ]);
  });
  it('retire un item et supprime la journée devenue vide', () => {
    const p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, ids());
    assert.deepEqual(findItem(p, { date: '2026-09-07', itemId: 'i1' }), { slot: 'soir', item: { id: 'i1', recipeId: 'burger', portions: 1 } });
    const p2 = removeItem(p, { date: '2026-09-07', itemId: 'i1' });
    assert.deepEqual(p2.days, {});
    assert.equal(findItem(p2, { date: '2026-09-07', itemId: 'i1' }), null);
  });
  it('change les portions', () => {
    const p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, ids());
    assert.equal(setPortions(p, { date: '2026-09-07', itemId: 'i1', portions: 3 }).days['2026-09-07'].soir[0].portions, 3);
    assert.throws(() => setPortions(p, { date: '2026-09-07', itemId: 'i1', portions: 0 }), RangeError);
    assert.throws(() => setPortions(p, { date: '2026-09-07', itemId: 'i1', portions: 7 }), RangeError);
  });
  it('rejette date, créneau, recette ou portions invalides, et un créneau plein', () => {
    assert.throws(() => addItem(emptyPlanner(), { date: 'x', slot: 'soir', recipeId: 'burger' }), RangeError);
    assert.throws(() => addItem(emptyPlanner(), { date: '2026-09-07', slot: 'brunch', recipeId: 'burger' }), RangeError);
    assert.throws(() => addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: '' }), RangeError);
    assert.throws(() => addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger', portions: 1.5 }), RangeError);
    let p = emptyPlanner();
    for (let i = 0; i < 6; i += 1) p = addItem(p, { date: '2026-09-07', slot: 'snack', recipeId: 'bowl' }, ids());
    assert.throws(() => addItem(p, { date: '2026-09-07', slot: 'snack', recipeId: 'bowl' }), /plein/);
  });
});

describe('restes du midi (§2.5)', () => {
  it('propose les dîners de la veille et les ajoute au midi, liés au plat d’origine', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, make);
    assert.deepEqual(leftoverCandidates(p, '2026-09-08').map((c) => c.item.id), ['i1']);
    const result = addLeftovers(p, '2026-09-08', make);
    assert.equal(result.added, 1);
    p = result.planner;
    assert.deepEqual(p.days['2026-09-08'].midi, [{ id: 'i2', recipeId: 'burger', portions: 1, leftoverOf: { date: '2026-09-07', itemId: 'i1' } }]);
  });
  it('n’ajoute pas deux fois le même reste, et un reste n’engendre pas de reste', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, make);
    p = addLeftovers(p, '2026-09-08', make).planner;
    assert.equal(addLeftovers(p, '2026-09-08', make).added, 0);
    assert.deepEqual(leftoverCandidates(p, '2026-09-09'), []);
  });
  it('rien la veille → rien à reprendre', () => {
    assert.equal(addLeftovers(emptyPlanner(), '2026-09-08').added, 0);
  });
  it('les portions cuisinées d’un dîner incluent ses restes', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, make);
    const dinner = p.days['2026-09-07'].soir[0];
    assert.equal(cookedPortions(p, '2026-09-07', dinner), 1);
    p = addLeftovers(p, '2026-09-08', make).planner;
    assert.equal(cookedPortions(p, '2026-09-07', dinner), 2);
  });
});

describe('jauges (§2.3)', () => {
  const burger = nutritionById.get('burger'); // 306 kcal, P 31,7 g, fibres 3,6 g par portion → 3 pts
  const bowl = nutritionById.get('bowl'); // 167,4 kcal, P 23,4 g → 1 pt

  it('les points des recettes de test sont ceux attendus', () => {
    assert.equal(burger.points, 3);
    assert.equal(bowl.points, 1);
  });
  it('totaux d’une journée = somme points × portions', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'matin', recipeId: 'bowl' }, make);
    p = addItem(p, { date: '2026-09-07', slot: 'soir', recipeId: 'burger', portions: 2 }, make);
    const t = dayTotals(p, '2026-09-07', nutritionById);
    assert.equal(t.items, 2);
    assert.equal(t.points, bowl.points + burger.points * 2);
    assert.equal(t.protein, Math.round((bowl.perPortion.protein + burger.perPortion.protein * 2) * 10) / 10);
    assert.equal(t.kcal, Math.round((bowl.perPortion.kcal + burger.perPortion.kcal * 2) * 10) / 10);
  });
  it('recette inconnue ignorée, journée vide = zéro', () => {
    const p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'matin', recipeId: 'disparue' }, ids());
    assert.deepEqual(dayTotals(p, '2026-09-07', nutritionById), { points: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, items: 0 });
    assert.equal(dayTotals(emptyPlanner(), '2026-09-07', nutritionById).points, 0);
  });
  it('totaux de la semaine et jours planifiés', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, make);
    p = addItem(p, { date: '2026-09-09', slot: 'matin', recipeId: 'bowl' }, make);
    const w = weekTotals(p, weekDates('2026-09-07'), nutritionById);
    assert.equal(w.points, burger.points + bowl.points);
    assert.equal(w.plannedDays, 2);
    assert.equal(w.days['2026-09-09'].points, bowl.points);
    assert.equal(w.days['2026-09-10'].points, 0);
  });
});

describe('liste de courses (§2.5)', () => {
  it('agrège par rayon, dans l’ordre des rayons, avec pièces et millilitres', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger', portions: 2 }, make);
    p = addItem(p, { date: '2026-09-08', slot: 'matin', recipeId: 'bowl' }, make);
    p = addItem(p, { date: '2026-09-09', slot: 'matin', recipeId: 'bowl' }, make);
    const list = shoppingList(p, weekDates('2026-09-07'), catalog);
    assert.deepEqual(list.groups.map((g) => g.label), ['Boucherie & volaille', 'Boulangerie', 'Crémerie & œufs']);
    const boeuf = list.groups[0].items[0];
    assert.equal(boeuf.grams, 250);
    assert.equal(boeuf.pieces, null);
    const pain = list.groups[1].items[0];
    assert.equal(pain.pieces, 2);
    assert.equal(pain.pieceName, 'pain');
    const cremerie = list.groups[2].items;
    assert.deepEqual(cremerie.map((i) => i.name), ['Lait', 'Skyr']);
    assert.equal(cremerie[0].ml, 200);
    assert.equal(cremerie[1].grams, 400);
    assert.deepEqual(list.pantry.map((i) => i.name), ['Sel']);
  });
  it('les restes ne sont pas achetés deux fois, mais le dîner est cuisiné pour eux', () => {
    const make = ids();
    let p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'burger' }, make);
    let list = shoppingList(p, weekDates('2026-09-07'), catalog);
    assert.equal(list.groups[0].items[0].grams, 125, '1 portion cuisinée = moitié de la recette');
    p = addLeftovers(p, '2026-09-08', make).planner;
    list = shoppingList(p, weekDates('2026-09-07'), catalog);
    assert.equal(list.groups[0].items[0].grams, 250, '1 portion + 1 reste = recette entière');
  });
  it('semaine vide → liste vide ; recette inconnue ignorée', () => {
    assert.deepEqual(shoppingList(emptyPlanner(), weekDates('2026-09-07'), catalog), { groups: [], pantry: [] });
    const p = addItem(emptyPlanner(), { date: '2026-09-07', slot: 'soir', recipeId: 'disparue' }, ids());
    assert.deepEqual(shoppingList(p, weekDates('2026-09-07'), catalog).groups, []);
  });
  it('coche et décoche par semaine', () => {
    let p = toggleShopping(emptyPlanner(), '2026-09-07', 'boeuf');
    assert.deepEqual([...shoppingChecked(p, '2026-09-07')], ['boeuf']);
    assert.deepEqual([...shoppingChecked(p, '2026-09-14')], []);
    p = toggleShopping(p, '2026-09-07', 'boeuf');
    assert.deepEqual(p.shopping, {});
  });
});

describe('normalisation', () => {
  it('ignore les entrées invalides et conserve les valides', () => {
    const raw = {
      days: {
        '2026-09-07': { soir: [{ id: 'a', recipeId: 'burger', portions: 2 }, { recipeId: '', portions: 1 }, { recipeId: 'x', portions: 9 }], brunch: [{ recipeId: 'x', portions: 1 }] },
        hier: { soir: [{ recipeId: 'burger', portions: 1 }] },
        '2026-09-08': { midi: [{ recipeId: 'burger', portions: 1, leftoverOf: { date: '2026-09-07', itemId: 'a' } }] },
      },
      shopping: { '2026-09-07': { boeuf: true, pain: false }, nope: { x: true } },
    };
    const p = normalizePlanner(raw);
    assert.deepEqual(Object.keys(p.days), ['2026-09-07', '2026-09-08']);
    assert.deepEqual(p.days['2026-09-07'].soir, [{ id: 'a', recipeId: 'burger', portions: 2 }]);
    assert.equal(p.days['2026-09-08'].midi[0].leftoverOf.itemId, 'a');
    assert.ok(p.days['2026-09-08'].midi[0].id);
    assert.deepEqual(p.shopping, { '2026-09-07': { boeuf: true } });
  });
  it('entrée absente ou aberrante → planning vide', () => {
    assert.deepEqual(normalizePlanner(undefined), emptyPlanner());
    assert.deepEqual(normalizePlanner('x'), emptyPlanner());
  });
});
