/**
 * Tous les paramètres ajustables de l'application (brief §4).
 * On modifie ici, jamais dans les formules de nutrition.js.
 */

/** Facteurs d'activité appliqués au métabolisme de base (§4.3). */
export const ACTIVITY_LEVELS = Object.freeze([
  { factor: 1.2, label: 'Sédentaire', hint: 'bureau, peu de marche' },
  { factor: 1.375, label: 'Léger', hint: '1 à 3 séances légères / sem.' },
  { factor: 1.55, label: 'Modéré', hint: '3 à 5 séances / sem.' },
  { factor: 1.725, label: 'Actif', hint: '6 à 7 séances / sem.' },
  { factor: 1.9, label: 'Très actif', hint: 'sport intense quotidien ou métier physique' },
]);

/** Objectifs : ajustement kcal par défaut (%) et protéines par défaut (g/kg). */
export const GOALS = Object.freeze({
  loss: { label: 'Perte de poids', defaultAdjustPct: -15, proteinPerKg: 1.8 },
  maintain: { label: 'Maintien', defaultAdjustPct: 0, proteinPerKg: 1.6 },
  gain: { label: 'Prise de muscle', defaultAdjustPct: 15, proteinPerKg: 2.0 },
});

/** Bornes de l'ajustement kcal réglable (déficit / surplus). */
export const GOAL_ADJUST_RANGE = Object.freeze({ min: -40, max: 40 });

/** Coefficients de Mifflin-St Jeor (§4.2). */
export const MIFFLIN_ST_JEOR = Object.freeze({
  weightCoef: 10,
  heightCoef: 6.25,
  ageCoef: 5,
  sexOffset: Object.freeze({ m: 5, f: -161 }),
});

/** Plancher de sécurité de la cible kcal, par sexe (§4.3). */
export const KCAL_FLOOR = Object.freeze({ m: 1500, f: 1200 });

/** Répartition en macros (§4.3). */
export const MACROS = Object.freeze({
  fatPerKg: 0.9,
  kcalPerGram: Object.freeze({ protein: 4, fat: 9, carbs: 4 }),
  fiberPerDay: Object.freeze({ min: 25, max: 30 }),
});

/** Système de points (§4.4). */
export const POINTS = Object.freeze({
  kcalDivisor: 50,
  proteinDivisor: 10,
  /** Arrondi au demi-point. */
  step: 0.5,
  min: 0,
  /** Mettre à null pour désactiver le bonus fibres. */
  fiberBonus: Object.freeze({ thresholdG: 5, points: -0.5 }),
  /** Mettre à null pour désactiver le malus sucres ajoutés. */
  addedSugarMalus: Object.freeze({ thresholdG: 15, points: 0.5 }),
  /** Budget hebdo = 7 × quotidien × ce facteur (jokers resto / soirée). */
  weeklyJokerFactor: 1.1,
});

/** Rappel de pesée par défaut (jours). */
export const DEFAULT_WEIGH_IN_EVERY_DAYS = 14;

/** Bornes de validation du profil. */
export const PROFILE_LIMITS = Object.freeze({
  nameMaxLength: 40,
  ageYears: Object.freeze({ min: 10, max: 120 }),
  heightCm: Object.freeze({ min: 100, max: 250 }),
  weightKg: Object.freeze({ min: 30, max: 300 }),
  weighInEveryDays: Object.freeze({ min: 1, max: 90 }),
  proteinPerKg: Object.freeze({ min: 0.8, max: 3 }),
  fatPerKg: Object.freeze({ min: 0.3, max: 2 }),
});
