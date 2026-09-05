import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ACTIVITY_LEVELS, POINTS } from '../js/config.js';
import {
  ageFromBirthDate,
  bmr,
  computeTargets,
  dailyPointsBudget,
  defaultProteinPerKg,
  macroTargets,
  parseDateParts,
  points,
  roundToStep,
  targetKcal,
  tdee,
  weeklyPointsBudget,
} from '../js/nutrition.js';

describe('§4.1 — âge en années révolues', () => {
  it("anniversaire déjà passé dans l'année", () => {
    assert.equal(ageFromBirthDate('1990-01-01', '2026-09-05'), 36);
  });
  it("anniversaire le jour même", () => {
    assert.equal(ageFromBirthDate('1990-09-05', '2026-09-05'), 36);
  });
  it('anniversaire demain : pas encore révolu', () => {
    assert.equal(ageFromBirthDate('1990-09-06', '2026-09-05'), 35);
  });
  it('né un 29 février : compté le 1er mars les années non bissextiles', () => {
    assert.equal(ageFromBirthDate('2000-02-29', '2027-02-28'), 26);
    assert.equal(ageFromBirthDate('2000-02-29', '2027-03-01'), 27);
    assert.equal(ageFromBirthDate('2000-02-29', '2028-02-29'), 28);
  });
  it("accepte un objet Date pour « aujourd'hui »", () => {
    assert.equal(ageFromBirthDate('1990-01-01', new Date(2026, 8, 5)), 36);
  });
  it('date de naissance dans le futur → âge négatif (à rejeter par la validation)', () => {
    assert.equal(ageFromBirthDate('2030-01-01', '2026-09-05'), -4);
  });
  it('dates invalides → null', () => {
    assert.equal(ageFromBirthDate('abc', '2026-09-05'), null);
    assert.equal(ageFromBirthDate('2023-02-30', '2026-09-05'), null);
    assert.equal(ageFromBirthDate('', '2026-09-05'), null);
    assert.equal(ageFromBirthDate(null, '2026-09-05'), null);
    assert.equal(ageFromBirthDate('1990-01-01', 'hier'), null);
  });
  it('parseDateParts rejette les formats non ISO et les dates inexistantes', () => {
    assert.deepEqual(parseDateParts('2026-09-05'), { y: 2026, m: 9, d: 5 });
    assert.equal(parseDateParts('05/09/2026'), null);
    assert.equal(parseDateParts('2026-13-01'), null);
    assert.equal(parseDateParts(new Date('invalid')), null);
  });
});

describe('§4.2 — métabolisme de base (Mifflin-St Jeor)', () => {
  it('homme : 10 × 80 + 6,25 × 180 − 5 × 36 + 5 = 1750', () => {
    assert.equal(bmr({ sex: 'm', weightKg: 80, heightCm: 180, ageYears: 36 }), 1750);
  });
  it('femme : 10 × 65 + 6,25 × 165 − 5 × 30 − 161 = 1370,25', () => {
    assert.equal(bmr({ sex: 'f', weightKg: 65, heightCm: 165, ageYears: 30 }), 1370.25);
  });
  it('sexe inconnu → erreur', () => {
    assert.throws(() => bmr({ sex: 'x', weightKg: 80, heightCm: 180, ageYears: 36 }), RangeError);
  });
});

describe('§4.3 — dépense journalière et cible kcal', () => {
  it('les cinq facteurs d’activité du brief sont ceux de config.js', () => {
    assert.deepEqual(ACTIVITY_LEVELS.map((l) => l.factor), [1.2, 1.375, 1.55, 1.725, 1.9]);
  });
  it('TDEE = BMR × facteur', () => {
    assert.equal(tdee(1750, 1.55), 2712.5);
    assert.equal(tdee(1750, 1.2), 2100);
  });
  it('déficit de 15 % : 2712,5 × 0,85 = 2305,625 → 2306 kcal', () => {
    const t = targetKcal(2712.5, -15, 'm');
    assert.equal(t.kcal, 2306);
    assert.ok(Math.abs(t.rawKcal - 2305.625) < 1e-9);
    assert.equal(t.belowFloor, false);
    assert.equal(t.floor, 1500);
  });
  it('maintien : 0 %', () => {
    assert.equal(targetKcal(2000, 0, 'm').kcal, 2000);
  });
  it('surplus de 15 %', () => {
    assert.equal(targetKcal(2000, 15, 'f').kcal, 2300);
  });
  it('plancher homme : 1600 × 0,85 = 1360 → relevé à 1500 avec avertissement', () => {
    const t = targetKcal(1600, -15, 'm');
    assert.equal(t.kcal, 1500);
    assert.equal(t.belowFloor, true);
    assert.equal(t.rawKcal, 1360);
  });
  it('plancher femme : 1300 × 0,85 = 1105 → relevé à 1200 avec avertissement', () => {
    const t = targetKcal(1300, -15, 'f');
    assert.equal(t.kcal, 1200);
    assert.equal(t.belowFloor, true);
  });
  it('exactement au plancher : pas d’avertissement', () => {
    assert.equal(targetKcal(1500, 0, 'm').belowFloor, false);
  });
  it('plancher paramétrable', () => {
    assert.equal(targetKcal(1600, -15, 'm', { m: 1000, f: 1000 }).belowFloor, false);
  });
});

describe('§4.3 — répartition en macros', () => {
  it('protéines par défaut selon l’objectif : 1,8 / 1,6 / 2,0 g/kg', () => {
    assert.equal(defaultProteinPerKg('loss'), 1.8);
    assert.equal(defaultProteinPerKg('maintain'), 1.6);
    assert.equal(defaultProteinPerKg('gain'), 2.0);
    assert.throws(() => defaultProteinPerKg('autre'), RangeError);
  });
  it('80 kg, 2306 kcal, 1,8 g/kg : P 144 g · L 72 g · G (2306 − 576 − 648) / 4 = 270,5 → 271 g', () => {
    const m = macroTargets({ kcal: 2306, weightKg: 80, proteinPerKg: 1.8 });
    assert.equal(m.proteinG, 144);
    assert.equal(m.fatG, 72);
    assert.equal(m.carbsG, 271);
    assert.equal(m.carbsClamped, false);
    assert.equal(m.fiberMinG, 25);
    assert.equal(m.fiberMaxG, 30);
  });
  it('les g/kg sont arrondis au gramme (82,3 kg × 1,8 = 148,14 → 148 g)', () => {
    assert.equal(macroTargets({ kcal: 2300, weightKg: 82.3, proteinPerKg: 1.8 }).proteinG, 148);
  });
  it('lipides paramétrables', () => {
    assert.equal(macroTargets({ kcal: 2306, weightKg: 80, proteinPerKg: 1.8, fatPerKg: 0.7 }).fatG, 56);
  });
  it('glucides jamais négatifs : tronqués à 0 avec un drapeau', () => {
    const m = macroTargets({ kcal: 1200, weightKg: 120, proteinPerKg: 2.0 });
    assert.equal(m.proteinG, 240);
    assert.equal(m.fatG, 108);
    assert.equal(m.carbsG, 0);
    assert.equal(m.carbsClamped, true);
  });
});

describe('§4.4 — points', () => {
  it('formule de base : 500 kcal, 40 g P → 10 − 4 = 6', () => {
    assert.equal(points({ kcal: 500, proteinG: 40 }), 6);
  });
  it('arrondi au demi-point (moitié vers le haut)', () => {
    assert.equal(roundToStep(6.6), 6.5);
    assert.equal(roundToStep(6.8), 7);
    assert.equal(roundToStep(6.24), 6);
    assert.equal(roundToStep(6.25), 6.5);
    assert.equal(roundToStep(6.75), 7);
    assert.equal(points({ kcal: 520, proteinG: 38 }), 6.5); // 10,4 − 3,8 = 6,6
    assert.equal(points({ kcal: 530, proteinG: 38 }), 7); // 10,6 − 3,8 = 6,8
    assert.equal(points({ kcal: 500, proteinG: 37.5 }), 6.5); // 6,25 → 6,5
  });
  it('minimum 0 (jamais négatif, ni −0)', () => {
    const p = points({ kcal: 100, proteinG: 25 }); // 2 − 2,5 = −0,5
    assert.equal(p, 0);
    assert.equal(Object.is(p, -0), false);
  });
  it('bonus fibres : −0,5 à partir de 5 g', () => {
    assert.equal(points({ kcal: 500, proteinG: 40, fiberG: 5 }), 5.5);
    assert.equal(points({ kcal: 500, proteinG: 40, fiberG: 4.9 }), 6);
  });
  it('malus sucres ajoutés : +0,5 au-delà de 15 g (15 g exactement : rien)', () => {
    assert.equal(points({ kcal: 500, proteinG: 40, addedSugarG: 15 }), 6);
    assert.equal(points({ kcal: 500, proteinG: 40, addedSugarG: 15.1 }), 6.5);
  });
  it('bonus et malus se cumulent', () => {
    assert.equal(points({ kcal: 500, proteinG: 40, fiberG: 6, addedSugarG: 20 }), 6);
  });
  it('coefficients centralisés dans config.js et surchargeables', () => {
    assert.equal(points({ kcal: 500, proteinG: 40 }, { ...POINTS, kcalDivisor: 100 }), 1);
    assert.equal(points({ kcal: 500, proteinG: 40, fiberG: 10 }, { ...POINTS, fiberBonus: null }), 6);
    assert.equal(points({ kcal: 500, proteinG: 40, addedSugarG: 30 }, { ...POINTS, addedSugarMalus: null }), 6);
    assert.equal(points({ kcal: 100, proteinG: 25 }, { ...POINTS, min: 1 }), 1);
  });
  it('budget quotidien : cible 2306 kcal / 144 g P → 46,12 − 14,4 = 31,72 → 31,5', () => {
    assert.equal(dailyPointsBudget(2306, 144), 31.5);
  });
  it('budget hebdo : 7 × 31,5 × 1,10 = 242,55 → 242,5', () => {
    assert.equal(weeklyPointsBudget(31.5), 242.5);
  });
  it('budget hebdo sans jokers', () => {
    assert.equal(weeklyPointsBudget(31.5, { ...POINTS, weeklyJokerFactor: 1 }), 220.5);
  });
});

describe('computeTargets — profil de référence du brief (§3.2)', () => {
  const inputs = { sex: 'm', weightKg: 80, heightCm: 180, ageYears: 36, activityFactor: 1.55, goal: 'loss', goalAdjustPct: -15 };

  it('enchaîne BMR → TDEE → cible → macros → points', () => {
    const t = computeTargets(inputs);
    assert.equal(t.bmr, 1750);
    assert.equal(t.tdee, 2712.5);
    assert.equal(t.kcal, 2306);
    assert.equal(t.belowFloor, false);
    assert.equal(t.proteinG, 144);
    assert.equal(t.fatG, 72);
    assert.equal(t.carbsG, 271);
    assert.equal(t.dailyPoints, 31.5);
    assert.equal(t.weeklyPoints, 242.5);
    assert.equal(t.proteinPerKg, 1.8);
    assert.equal(t.fatPerKg, 0.9);
    assert.equal(t.goalAdjustPct, -15);
  });
  it('ajustement absent → valeur par défaut de l’objectif', () => {
    const t = computeTargets({ ...inputs, goalAdjustPct: undefined });
    assert.equal(t.goalAdjustPct, -15);
    assert.equal(t.kcal, 2306);
  });
  it('prise de muscle : +15 % et 2,0 g/kg', () => {
    const t = computeTargets({ ...inputs, goal: 'gain', goalAdjustPct: undefined });
    assert.equal(t.kcal, 3119); // 2712,5 × 1,15 = 3119,375
    assert.equal(t.proteinG, 160);
  });
  it('maintien : 0 % et 1,6 g/kg', () => {
    const t = computeTargets({ ...inputs, goal: 'maintain', goalAdjustPct: undefined });
    assert.equal(t.kcal, 2713); // 2712,5 → 2713
    assert.equal(t.proteinG, 128);
  });
  it('surcharges g/kg respectées', () => {
    const t = computeTargets({ ...inputs, proteinPerKg: 2.2, fatPerKg: 0.8 });
    assert.equal(t.proteinG, 176);
    assert.equal(t.fatG, 64);
  });
  it('petit gabarit sédentaire : plancher appliqué et signalé', () => {
    const t = computeTargets({ sex: 'f', weightKg: 50, heightCm: 158, ageYears: 60, activityFactor: 1.2, goal: 'loss', goalAdjustPct: -15 });
    // BMR = 500 + 987,5 − 300 − 161 = 1026,5 ; TDEE = 1231,8 ; ×0,85 = 1047 → plancher 1200
    assert.equal(t.kcal, 1200);
    assert.equal(t.belowFloor, true);
  });
  it('objectif inconnu → erreur', () => {
    assert.throws(() => computeTargets({ ...inputs, goal: 'bulk' }), RangeError);
  });
});
