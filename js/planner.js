/**
 * Planning (brief §2.3 et §2.5) : journées et semaines, créneaux, restes du midi,
 * totaux de points et de protéines, liste de courses agrégée par rayon.
 * Fonctions pures : le planning est un objet { days: { 'AAAA-MM-JJ': { matin: [items], … } }, shopping: {} }.
 */
import { PLANNER_LIMITS, PLANNER_SLOTS, WEEK_STARTS_ON } from './config.js';
import { formatISODate, parseDateParts } from './nutrition.js';
import { ingredientGrams, round1, scaleRecipe } from './recipes.js';

export const SLOT_IDS = PLANNER_SLOTS.map((slot) => slot.id);

/* ---------- Dates ---------- */

/** Date ISO décalée de n jours (calendrier local). */
export function addDays(iso, n) {
  const p = parseDateParts(iso);
  if (!p) throw new RangeError(`Date invalide : ${iso}`);
  const d = new Date(p.y, p.m - 1, p.d + n);
  return formatISODate({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

/** Premier jour (lundi par défaut) de la semaine contenant la date. */
export function weekStart(iso) {
  const p = parseDateParts(iso);
  if (!p) throw new RangeError(`Date invalide : ${iso}`);
  const weekday = new Date(p.y, p.m - 1, p.d).getDay();
  return addDays(iso, -((weekday - WEEK_STARTS_ON + 7) % 7));
}

/** Les 7 dates de la semaine contenant la date. */
export function weekDates(iso) {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/* ---------- Modèle ---------- */

export function emptyPlanner() {
  return { days: {}, shopping: {} };
}

let counter = 0;
function defaultId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidPortions(value) {
  return Number.isInteger(value) && value >= 1 && value <= PLANNER_LIMITS.maxPortions;
}

/** Ramène un planning quelconque à une forme sûre (entrées invalides ignorées). */
export function normalizePlanner(input) {
  const planner = emptyPlanner();
  if (!isRecord(input)) return planner;
  for (const [date, day] of Object.entries(input.days ?? {})) {
    if (!parseDateParts(date) || !isRecord(day)) continue;
    const cleanDay = {};
    for (const slot of SLOT_IDS) {
      const items = Array.isArray(day[slot]) ? day[slot] : [];
      const clean = items
        .filter((item) => isRecord(item) && typeof item.recipeId === 'string' && item.recipeId && isValidPortions(item.portions))
        .slice(0, PLANNER_LIMITS.maxItemsPerSlot)
        .map((item) => {
          const copy = { id: typeof item.id === 'string' && item.id ? item.id : defaultId(), recipeId: item.recipeId, portions: item.portions };
          if (isRecord(item.leftoverOf) && parseDateParts(item.leftoverOf.date) && typeof item.leftoverOf.itemId === 'string') {
            copy.leftoverOf = { date: item.leftoverOf.date, itemId: item.leftoverOf.itemId };
          }
          return copy;
        });
      if (clean.length) cleanDay[slot] = clean;
    }
    if (Object.keys(cleanDay).length) planner.days[date] = cleanDay;
  }
  for (const [week, checked] of Object.entries(input.shopping ?? {})) {
    if (!parseDateParts(week) || !isRecord(checked)) continue;
    const ids = Object.keys(checked).filter((id) => checked[id] === true);
    if (ids.length) planner.shopping[week] = Object.fromEntries(ids.map((id) => [id, true]));
  }
  return planner;
}

/** Journée normalisée : un tableau par créneau (copies). */
export function dayPlan(planner, iso) {
  const day = planner?.days?.[iso] ?? {};
  return Object.fromEntries(SLOT_IDS.map((slot) => [slot, [...(day[slot] ?? [])]]));
}

/** Tous les items d'une journée, avec leur créneau. */
export function dayItems(planner, iso) {
  const day = dayPlan(planner, iso);
  return SLOT_IDS.flatMap((slot) => day[slot].map((item) => ({ slot, ...item })));
}

function withDay(planner, iso, day) {
  const days = { ...planner.days };
  const compact = Object.fromEntries(Object.entries(day).filter(([, items]) => items.length > 0));
  if (Object.keys(compact).length) days[iso] = compact;
  else delete days[iso];
  return { ...planner, days };
}

/** Ajoute une recette à un créneau ; retourne un nouveau planning. */
export function addItem(planner, { date, slot, recipeId, portions = 1, leftoverOf = null }, makeId = defaultId) {
  if (!parseDateParts(date)) throw new RangeError('Date invalide.');
  if (!SLOT_IDS.includes(slot)) throw new RangeError(`Créneau inconnu : ${slot}`);
  if (typeof recipeId !== 'string' || !recipeId) throw new RangeError('Recette manquante.');
  if (!isValidPortions(portions)) throw new RangeError(`Portions : de 1 à ${PLANNER_LIMITS.maxPortions}.`);
  const day = dayPlan(planner, date);
  if (day[slot].length >= PLANNER_LIMITS.maxItemsPerSlot) throw new RangeError('Ce créneau est plein.');
  const item = { id: makeId(), recipeId, portions };
  if (leftoverOf) item.leftoverOf = { date: leftoverOf.date, itemId: leftoverOf.itemId };
  day[slot] = [...day[slot], item];
  return withDay(planner, date, day);
}

/** Retrouve un item d'une journée : { slot, item } ou null. */
export function findItem(planner, { date, itemId }) {
  const day = dayPlan(planner, date);
  for (const slot of SLOT_IDS) {
    const item = day[slot].find((it) => it.id === itemId);
    if (item) return { slot, item };
  }
  return null;
}

/** Retire un item ; retourne un nouveau planning. */
export function removeItem(planner, { date, itemId }) {
  const day = dayPlan(planner, date);
  for (const slot of SLOT_IDS) day[slot] = day[slot].filter((item) => item.id !== itemId);
  return withDay(planner, date, day);
}

/** Change le nombre de portions d'un item. */
export function setPortions(planner, { date, itemId, portions }) {
  if (!isValidPortions(portions)) throw new RangeError(`Portions : de 1 à ${PLANNER_LIMITS.maxPortions}.`);
  const day = dayPlan(planner, date);
  for (const slot of SLOT_IDS) day[slot] = day[slot].map((item) => (item.id === itemId ? { ...item, portions } : item));
  return withDay(planner, date, day);
}

/* ---------- Restes du midi (§2.5) ---------- */

/** Dîners de la veille (hors restes eux-mêmes) réutilisables le midi. */
export function leftoverCandidates(planner, iso) {
  const yesterday = addDays(iso, -1);
  return dayPlan(planner, yesterday)
    .soir.filter((item) => !item.leftoverOf)
    .map((item) => ({ fromDate: yesterday, item }));
}

/** Les restes déjà planifiés à midi pour cette date, indexés par item d'origine. */
function linkedLeftovers(planner, iso) {
  return new Set(dayPlan(planner, iso).midi.filter((item) => item.leftoverOf).map((item) => `${item.leftoverOf.date}/${item.leftoverOf.itemId}`));
}

/**
 * « Midi = restes d'hier soir » : ajoute au midi une portion de chaque dîner de la veille
 * pas encore repris. Retourne { planner, added }.
 */
export function addLeftovers(planner, iso, makeId = defaultId) {
  const already = linkedLeftovers(planner, iso);
  let next = planner;
  let added = 0;
  for (const { fromDate, item } of leftoverCandidates(planner, iso)) {
    if (already.has(`${fromDate}/${item.id}`)) continue;
    next = addItem(next, { date: iso, slot: 'midi', recipeId: item.recipeId, portions: 1, leftoverOf: { date: fromDate, itemId: item.id } }, makeId);
    added += 1;
  }
  return { planner: next, added };
}

/** Portions à cuisiner pour un item : ses portions plus celles des restes qui y sont liés. */
export function cookedPortions(planner, date, item) {
  let total = item.portions;
  for (const day of Object.values(planner.days ?? {})) {
    for (const slot of SLOT_IDS) {
      for (const other of day[slot] ?? []) {
        if (other.leftoverOf && other.leftoverOf.date === date && other.leftoverOf.itemId === item.id) total += other.portions;
      }
    }
  }
  return total;
}

/* ---------- Totaux et jauges (§2.3) ---------- */

function emptyTotals() {
  return { points: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, items: 0 };
}

/** Points et macros consommés sur une journée, d'après les recettes planifiées. */
export function dayTotals(planner, iso, nutritionById) {
  const totals = emptyTotals();
  for (const item of dayItems(planner, iso)) {
    const n = nutritionById.get(item.recipeId);
    if (!n) continue;
    totals.items += 1;
    totals.points += n.points * item.portions;
    for (const key of ['kcal', 'protein', 'fat', 'carbs', 'fiber']) totals[key] += (n.perPortion[key] ?? 0) * item.portions;
  }
  for (const key of ['points', 'kcal', 'protein', 'fat', 'carbs', 'fiber']) totals[key] = round1(totals[key]);
  return totals;
}

/** Totaux d'une semaine (liste de dates) et détail par jour. */
export function weekTotals(planner, dates, nutritionById) {
  const week = { ...emptyTotals(), plannedDays: 0, days: {} };
  for (const iso of dates) {
    const day = dayTotals(planner, iso, nutritionById);
    week.days[iso] = day;
    if (day.items > 0) week.plannedDays += 1;
    for (const key of ['points', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'items']) week[key] += day[key];
  }
  for (const key of ['points', 'kcal', 'protein', 'fat', 'carbs', 'fiber']) week[key] = round1(week[key]);
  return week;
}

/* ---------- Liste de courses (§2.5) ---------- */

/**
 * Agrège les ingrédients des recettes à cuisiner sur les dates données, par rayon.
 * Les restes ne comptent pas (déjà cuisinés) ; les portions cuisinées d'un plat incluent ses restes.
 * Les ingrédients de placard (`pantry`) sont listés à part.
 */
export function shoppingList(planner, dates, { recipes, ingredientIndex, aisles = {} }) {
  const byRecipe = recipes instanceof Map ? recipes : new Map(recipes.map((r) => [r.id, r]));
  const totals = new Map();
  for (const date of dates) {
    for (const entry of dayItems(planner, date)) {
      if (entry.leftoverOf) continue;
      const recipe = byRecipe.get(entry.recipeId);
      if (!recipe || recipe.nutritionOverride) continue;
      const portions = Math.min(PLANNER_LIMITS.maxPortions * 2, cookedPortions(planner, date, entry));
      const scaled = scaleRecipe(recipe, portions);
      for (const line of scaled.ingredients) {
        const ingredient = ingredientIndex.get(line.ref);
        if (!ingredient) continue;
        const grams = ingredientGrams(line, ingredient);
        const acc = totals.get(line.ref) ?? { ingredient, grams: 0, recipes: new Set() };
        acc.grams += grams;
        acc.recipes.add(recipe.title);
        totals.set(line.ref, acc);
      }
    }
  }

  const groups = new Map();
  const pantry = [];
  for (const [id, acc] of totals) {
    const { ingredient } = acc;
    const item = {
      id,
      name: ingredient.name,
      grams: Math.round(acc.grams),
      pieces: ingredient.piece?.grams ? Math.round((acc.grams / ingredient.piece.grams) * 10) / 10 : null,
      pieceName: ingredient.piece?.name ?? null,
      ml: ingredient.gPerMl ? Math.round(acc.grams / ingredient.gPerMl) : null,
      recipes: [...acc.recipes],
    };
    if (ingredient.pantry) {
      pantry.push(item);
      continue;
    }
    const aisle = ingredient.aisle ?? 'autre';
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(item);
  }
  const order = Object.keys(aisles);
  const sortedAisles = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  return {
    groups: sortedAisles.map((aisle) => ({ aisle, label: aisles[aisle] ?? aisle, items: groups.get(aisle).sort(byName) })),
    pantry: pantry.sort(byName),
  };
}

/** Coche / décoche un ingrédient dans la liste de courses d'une semaine (clé = lundi ISO). */
export function toggleShopping(planner, weekKey, ingredientId) {
  const current = { ...(planner.shopping?.[weekKey] ?? {}) };
  if (current[ingredientId]) delete current[ingredientId];
  else current[ingredientId] = true;
  const shopping = { ...planner.shopping };
  if (Object.keys(current).length) shopping[weekKey] = current;
  else delete shopping[weekKey];
  return { ...planner, shopping };
}

/** Ingrédients cochés pour une semaine. */
export function shoppingChecked(planner, weekKey) {
  return new Set(Object.keys(planner.shopping?.[weekKey] ?? {}));
}
