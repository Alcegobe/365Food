/**
 * Formules du brief §4 : âge, BMR, TDEE, cible kcal, macros, points.
 * Fonctions pures, sans accès au DOM ni au stockage : tout est testé dans tests/.
 */
import { ACTIVITY_LEVELS, GOALS, KCAL_FLOOR, MACROS, MIFFLIN_ST_JEOR, POINTS } from './config.js';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Décompose une date « AAAA-MM-JJ » ou un objet Date en { y, m, d } (calendrier local).
 * Retourne null si la date est absente, mal formée ou inexistante (ex. 2023-02-30).
 */
export function parseDateParts(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Formate { y, m, d } en « AAAA-MM-JJ ». */
export function formatISODate({ y, m, d }) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * §4.1 — Âge en années révolues à la date `today`.
 * Un anniversaire le 29 février est compté le 1er mars les années non bissextiles.
 * Retourne null si l'une des deux dates est invalide.
 */
export function ageFromBirthDate(birthDate, today = new Date()) {
  const b = parseDateParts(birthDate);
  const t = parseDateParts(today);
  if (!b || !t) return null;
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
  return age;
}

/** §4.2 — Métabolisme de base (Mifflin-St Jeor), en kcal/jour. */
export function bmr({ sex, weightKg, heightCm, ageYears }, cfg = MIFFLIN_ST_JEOR) {
  const offset = cfg.sexOffset[sex];
  if (offset === undefined) throw new RangeError(`Sexe inconnu : ${sex}`);
  return cfg.weightCoef * weightKg + cfg.heightCoef * heightCm - cfg.ageCoef * ageYears + offset;
}

/** §4.3 — Dépense énergétique journalière. */
export function tdee(bmrKcal, activityFactor) {
  return bmrKcal * activityFactor;
}

/** Niveau d'activité correspondant à un facteur, ou null. */
export function activityLevel(factor) {
  return ACTIVITY_LEVELS.find((level) => level.factor === factor) ?? null;
}

/**
 * §4.3 — Cible kcal = TDEE × (1 + ajustement / 100), arrondie à l'unité.
 * Si le résultat passe sous le plancher de sécurité du sexe, la cible est relevée
 * au plancher et `belowFloor` vaut true pour que l'interface avertisse.
 */
export function targetKcal(tdeeKcal, goalAdjustPct, sex, floors = KCAL_FLOOR) {
  const rawKcal = tdeeKcal * (1 + goalAdjustPct / 100);
  const rounded = Math.round(rawKcal);
  const floor = floors[sex] ?? 0;
  const belowFloor = rounded < floor;
  return { kcal: belowFloor ? floor : rounded, rawKcal, floor, belowFloor };
}

/** Protéines par défaut (g/kg) pour un objectif. */
export function defaultProteinPerKg(goal, goals = GOALS) {
  const cfg = goals[goal];
  if (!cfg) throw new RangeError(`Objectif inconnu : ${goal}`);
  return cfg.proteinPerKg;
}

/**
 * §4.3 — Répartition en macros : protéines et lipides en g/kg (arrondis au gramme),
 * glucides = le reste des kcal. Les glucides ne descendent jamais sous 0 ;
 * `carbsClamped` signale qu'ils ont dû être tronqués.
 */
export function macroTargets({ kcal, weightKg, proteinPerKg, fatPerKg = MACROS.fatPerKg }, cfg = MACROS) {
  const proteinG = Math.round(proteinPerKg * weightKg);
  const fatG = Math.round(fatPerKg * weightKg);
  const remainingKcal = kcal - cfg.kcalPerGram.protein * proteinG - cfg.kcalPerGram.fat * fatG;
  const carbsRaw = remainingKcal / cfg.kcalPerGram.carbs;
  return {
    proteinG,
    fatG,
    carbsG: Math.max(0, Math.round(carbsRaw)),
    carbsClamped: carbsRaw < 0,
    fiberMinG: cfg.fiberPerDay.min,
    fiberMaxG: cfg.fiberPerDay.max,
  };
}

/** Arrondit au multiple de `step` le plus proche (0,5 par défaut), moitié vers le haut. */
export function roundToStep(value, step = POINTS.step) {
  const rounded = Math.round(value / step) * step;
  return Math.round(rounded * 1e6) / 1e6;
}

/**
 * §4.4 — Points d'une portion (ou d'une journée) :
 * kcal / 50 − protéines / 10 + bonus/malus, arrondi au demi-point, minimum 0.
 */
export function points({ kcal, proteinG, fiberG = 0, addedSugarG = 0 }, cfg = POINTS) {
  let raw = kcal / cfg.kcalDivisor - proteinG / cfg.proteinDivisor;
  if (cfg.fiberBonus && fiberG >= cfg.fiberBonus.thresholdG) raw += cfg.fiberBonus.points;
  if (cfg.addedSugarMalus && addedSugarG > cfg.addedSugarMalus.thresholdG) raw += cfg.addedSugarMalus.points;
  return Math.max(cfg.min, roundToStep(raw, cfg.step));
}

/** §4.4 — Budget quotidien : la même formule appliquée à la cible kcal / protéines. */
export function dailyPointsBudget(kcal, proteinG, cfg = POINTS) {
  return points({ kcal, proteinG }, cfg);
}

/** §4.4 — Budget hebdomadaire = 7 × quotidien × jokers, arrondi au demi-point. */
export function weeklyPointsBudget(dailyPoints, cfg = POINTS) {
  return roundToStep(7 * dailyPoints * cfg.weeklyJokerFactor, cfg.step);
}

/**
 * Enchaîne toutes les formules pour un jeu d'entrées déjà résolues
 * (âge et poids courant calculés en amont).
 * `goalAdjustPct`, `proteinPerKg` et `fatPerKg` sont optionnels : valeurs par défaut de config.js.
 */
export function computeTargets({
  sex,
  weightKg,
  heightCm,
  ageYears,
  activityFactor,
  goal,
  goalAdjustPct,
  proteinPerKg,
  fatPerKg,
}) {
  const goalCfg = GOALS[goal];
  if (!goalCfg) throw new RangeError(`Objectif inconnu : ${goal}`);
  const adjustPct = goalAdjustPct ?? goalCfg.defaultAdjustPct;
  const pPerKg = proteinPerKg ?? goalCfg.proteinPerKg;
  const fPerKg = fatPerKg ?? MACROS.fatPerKg;

  const bmrKcal = bmr({ sex, weightKg, heightCm, ageYears });
  const tdeeKcal = tdee(bmrKcal, activityFactor);
  const target = targetKcal(tdeeKcal, adjustPct, sex);
  const macros = macroTargets({ kcal: target.kcal, weightKg, proteinPerKg: pPerKg, fatPerKg: fPerKg });
  const dailyPoints = dailyPointsBudget(target.kcal, macros.proteinG);

  return {
    sex,
    weightKg,
    heightCm,
    ageYears,
    activityFactor,
    goal,
    goalAdjustPct: adjustPct,
    proteinPerKg: pPerKg,
    fatPerKg: fPerKg,
    bmr: bmrKcal,
    tdee: tdeeKcal,
    ...target,
    ...macros,
    dailyPoints,
    weeklyPoints: weeklyPointsBudget(dailyPoints),
  };
}
