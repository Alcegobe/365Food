/**
 * Modèle du profil (brief §3.2) : valeurs par défaut, pesées, validation,
 * et passerelle vers les formules (targetsForProfile).
 */
import { ACTIVITY_LEVELS, DEFAULT_WEIGH_IN_EVERY_DAYS, GOALS, GOAL_ADJUST_RANGE, PROFILE_LIMITS } from './config.js';
import { ageFromBirthDate, computeTargets, formatISODate, parseDateParts } from './nutrition.js';

/** Date locale du jour au format « AAAA-MM-JJ ». */
export function todayISO(date = new Date()) {
  return formatISODate(parseDateParts(date));
}

/** Profil vierge (un seul champ est pré-rempli : les valeurs par défaut du brief). */
export function newProfile(overrides = {}) {
  return {
    /** Prénom facultatif, uniquement pour l'affichage. */
    name: '',
    birthDate: '',
    sex: 'm',
    heightCm: null,
    activity: 1.55,
    goal: 'loss',
    goalAdjustPct: GOALS.loss.defaultAdjustPct,
    weighInEveryDays: DEFAULT_WEIGH_IN_EVERY_DAYS,
    /** null = valeur par défaut de l'objectif (config.js). */
    proteinPerKg: null,
    /** null = valeur par défaut (config.js). */
    fatPerKg: null,
    weights: [],
    ...overrides,
  };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function inRange(value, { min, max }) {
  return isFiniteNumber(value) && value >= min && value <= max;
}

/** Dernière pesée (par date, quel que soit l'ordre du tableau) ou null. */
export function currentWeighIn(profile) {
  const weights = Array.isArray(profile?.weights) ? profile.weights : [];
  let latest = null;
  for (const entry of weights) {
    if (!entry || !parseDateParts(entry.date) || !isFiniteNumber(entry.kg)) continue;
    if (!latest || entry.date > latest.date) latest = entry;
  }
  return latest ? { date: latest.date, kg: latest.kg } : null;
}

/** Poids courant en kg, ou null. */
export function currentWeightKg(profile) {
  return currentWeighIn(profile)?.kg ?? null;
}

function utcDay({ y, m, d }) {
  return Date.UTC(y, m - 1, d) / 86400000;
}

/**
 * Rappel de pesée (brief §2.1) : `weighInEveryDays` jours après la dernière pesée, l'application
 * invite à se peser. Retourne null sans pesée valide.
 * { lastDate, everyDays, daysSince, daysLeft, nextDate, due }
 */
export function weighInStatus(profile, today = new Date()) {
  const last = currentWeighIn(profile);
  const t = parseDateParts(today);
  if (!last || !t) return null;
  const everyDays = Number.isInteger(profile?.weighInEveryDays) && profile.weighInEveryDays > 0 ? profile.weighInEveryDays : DEFAULT_WEIGH_IN_EVERY_DAYS;
  const l = parseDateParts(last.date);
  const daysSince = Math.round(utcDay(t) - utcDay(l));
  const next = new Date(Date.UTC(l.y, l.m - 1, l.d + everyDays));
  return {
    lastDate: last.date,
    everyDays,
    daysSince,
    daysLeft: Math.max(0, everyDays - daysSince),
    nextDate: formatISODate({ y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() }),
    due: daysSince >= everyDays,
  };
}

/**
 * Ajoute une pesée et retourne un nouveau profil (l'original n'est pas modifié).
 * Une pesée existante à la même date est remplacée ; le tableau reste trié par date.
 */
export function addWeighIn(profile, { date, kg }) {
  const parts = parseDateParts(date);
  if (!parts) throw new RangeError('Date de pesée invalide.');
  if (!inRange(kg, PROFILE_LIMITS.weightKg)) {
    throw new RangeError(`Poids invalide (${PROFILE_LIMITS.weightKg.min} à ${PROFILE_LIMITS.weightKg.max} kg).`);
  }
  const iso = formatISODate(parts);
  const others = (profile.weights ?? []).filter((entry) => entry.date !== iso);
  const weights = [...others, { date: iso, kg }].sort((a, b) => a.date.localeCompare(b.date));
  return { ...profile, weights };
}

/** Supprime la pesée à la date donnée ; retourne un nouveau profil. */
export function removeWeighIn(profile, date) {
  return { ...profile, weights: (profile.weights ?? []).filter((entry) => entry.date !== date) };
}

/**
 * Valide un profil. Retourne une liste de { field, message } (vide si tout est bon).
 */
export function validateProfile(profile, today = new Date()) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  if (!profile || typeof profile !== 'object') return [{ field: 'profile', message: 'Profil absent.' }];

  if (profile.name !== undefined && (typeof profile.name !== 'string' || profile.name.length > PROFILE_LIMITS.nameMaxLength)) {
    push('name', `Le prénom ne doit pas dépasser ${PROFILE_LIMITS.nameMaxLength} caractères.`);
  }

  const age = ageFromBirthDate(profile.birthDate, today);
  if (age === null) push('birthDate', 'Date de naissance invalide.');
  else if (age < 0) push('birthDate', 'La date de naissance est dans le futur.');
  else if (!inRange(age, PROFILE_LIMITS.ageYears)) {
    push('birthDate', `L'âge doit être compris entre ${PROFILE_LIMITS.ageYears.min} et ${PROFILE_LIMITS.ageYears.max} ans.`);
  }

  if (profile.sex !== 'm' && profile.sex !== 'f') push('sex', 'Sexe invalide.');

  if (!inRange(profile.heightCm, PROFILE_LIMITS.heightCm)) {
    push('heightCm', `La taille doit être comprise entre ${PROFILE_LIMITS.heightCm.min} et ${PROFILE_LIMITS.heightCm.max} cm.`);
  }

  if (!Array.isArray(profile.weights) || profile.weights.length === 0) {
    push('weights', 'Indique au moins une pesée.');
  } else {
    const bad = profile.weights.find((w) => !w || !parseDateParts(w.date) || !inRange(w.kg, PROFILE_LIMITS.weightKg));
    if (bad) push('weights', `Pesée invalide (date « AAAA-MM-JJ », poids de ${PROFILE_LIMITS.weightKg.min} à ${PROFILE_LIMITS.weightKg.max} kg).`);
  }

  if (!ACTIVITY_LEVELS.some((level) => level.factor === profile.activity)) push('activity', "Niveau d'activité inconnu.");

  if (!GOALS[profile.goal]) push('goal', 'Objectif inconnu.');

  if (!inRange(profile.goalAdjustPct, GOAL_ADJUST_RANGE)) {
    push('goalAdjustPct', `L'ajustement doit être compris entre ${GOAL_ADJUST_RANGE.min} % et +${GOAL_ADJUST_RANGE.max} %.`);
  }

  if (!Number.isInteger(profile.weighInEveryDays) || !inRange(profile.weighInEveryDays, PROFILE_LIMITS.weighInEveryDays)) {
    push('weighInEveryDays', `La fréquence de pesée doit être un nombre entier de ${PROFILE_LIMITS.weighInEveryDays.min} à ${PROFILE_LIMITS.weighInEveryDays.max} jours.`);
  }

  if (profile.proteinPerKg !== null && profile.proteinPerKg !== undefined && !inRange(profile.proteinPerKg, PROFILE_LIMITS.proteinPerKg)) {
    push('proteinPerKg', `Protéines : entre ${PROFILE_LIMITS.proteinPerKg.min} et ${PROFILE_LIMITS.proteinPerKg.max} g/kg.`);
  }
  if (profile.fatPerKg !== null && profile.fatPerKg !== undefined && !inRange(profile.fatPerKg, PROFILE_LIMITS.fatPerKg)) {
    push('fatPerKg', `Lipides : entre ${PROFILE_LIMITS.fatPerKg.min} et ${PROFILE_LIMITS.fatPerKg.max} g/kg.`);
  }

  return errors;
}

export function isProfileValid(profile, today = new Date()) {
  return validateProfile(profile, today).length === 0;
}

/**
 * Cibles du jour pour un profil (âge et poids courant résolus ici), ou null si le profil est invalide.
 */
export function targetsForProfile(profile, today = new Date()) {
  if (!isProfileValid(profile, today)) return null;
  return computeTargets({
    sex: profile.sex,
    weightKg: currentWeightKg(profile),
    heightCm: profile.heightCm,
    ageYears: ageFromBirthDate(profile.birthDate, today),
    activityFactor: profile.activity,
    goal: profile.goal,
    goalAdjustPct: profile.goalAdjustPct,
    proteinPerKg: profile.proteinPerKg ?? undefined,
    fatPerKg: profile.fatPerKg ?? undefined,
  });
}
