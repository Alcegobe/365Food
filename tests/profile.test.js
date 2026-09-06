import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addWeighIn,
  currentWeighIn,
  currentWeightKg,
  isProfileValid,
  newProfile,
  removeWeighIn,
  targetsForProfile,
  todayISO,
  validateProfile,
  weighInStatus,
} from '../js/profile.js';

const TODAY = '2026-09-05';

/** Profil de référence du brief §3.2. */
function briefProfile() {
  return newProfile({
    birthDate: '1990-01-01',
    sex: 'm',
    heightCm: 180,
    activity: 1.55,
    goal: 'loss',
    goalAdjustPct: -15,
    weighInEveryDays: 14,
    weights: [{ date: '2026-09-05', kg: 80.0 }],
  });
}

describe('todayISO', () => {
  it('formate une date locale en AAAA-MM-JJ avec zéros', () => {
    assert.equal(todayISO(new Date(2026, 8, 5)), '2026-09-05');
    assert.equal(todayISO(new Date(2026, 0, 3)), '2026-01-03');
  });
});

describe('pesées', () => {
  it('ajoute une pesée sans modifier le profil d’origine', () => {
    const p = briefProfile();
    const next = addWeighIn(p, { date: '2026-09-19', kg: 79.2 });
    assert.equal(p.weights.length, 1);
    assert.deepEqual(next.weights, [
      { date: '2026-09-05', kg: 80 },
      { date: '2026-09-19', kg: 79.2 },
    ]);
  });
  it('garde le tableau trié par date', () => {
    const next = addWeighIn(briefProfile(), { date: '2026-08-22', kg: 81 });
    assert.deepEqual(next.weights.map((w) => w.date), ['2026-08-22', '2026-09-05']);
  });
  it('remplace une pesée existante à la même date', () => {
    const next = addWeighIn(briefProfile(), { date: '2026-09-05', kg: 79.5 });
    assert.deepEqual(next.weights, [{ date: '2026-09-05', kg: 79.5 }]);
  });
  it('rejette une date ou un poids invalide', () => {
    assert.throws(() => addWeighIn(briefProfile(), { date: 'hier', kg: 80 }), RangeError);
    assert.throws(() => addWeighIn(briefProfile(), { date: '2026-09-06', kg: 20 }), RangeError);
    assert.throws(() => addWeighIn(briefProfile(), { date: '2026-09-06', kg: NaN }), RangeError);
  });
  it('supprime une pesée par date', () => {
    const p = addWeighIn(briefProfile(), { date: '2026-09-19', kg: 79.2 });
    assert.deepEqual(removeWeighIn(p, '2026-09-05').weights, [{ date: '2026-09-19', kg: 79.2 }]);
  });
  it('la pesée courante est la plus récente par date, quel que soit l’ordre', () => {
    const p = newProfile({ weights: [{ date: '2026-09-05', kg: 80 }, { date: '2026-08-01', kg: 83 }] });
    assert.deepEqual(currentWeighIn(p), { date: '2026-09-05', kg: 80 });
    assert.equal(currentWeightKg(p), 80);
  });
  it('sans pesée → null', () => {
    assert.equal(currentWeighIn(newProfile()), null);
    assert.equal(currentWeightKg({ weights: 'n/a' }), null);
  });
});

describe('validateProfile', () => {
  it('le profil de référence est valide', () => {
    assert.deepEqual(validateProfile(briefProfile(), TODAY), []);
    assert.equal(isProfileValid(briefProfile(), TODAY), true);
  });
  it('un profil vierge liste ce qui manque', () => {
    const fields = validateProfile(newProfile(), TODAY).map((e) => e.field);
    assert.ok(fields.includes('birthDate'));
    assert.ok(fields.includes('heightCm'));
    assert.ok(fields.includes('weights'));
  });
  const cases = [
    ['name', { name: 'x'.repeat(41) }],
    ['name', { name: 42 }],
    ['birthDate', { birthDate: '01/01/1990' }],
    ['birthDate', { birthDate: '2030-01-01' }],
    ['birthDate', { birthDate: '2020-01-01' }],
    ['sex', { sex: 'x' }],
    ['heightCm', { heightCm: 90 }],
    ['heightCm', { heightCm: '180' }],
    ['weights', { weights: [] }],
    ['weights', { weights: [{ date: '2026-09-05', kg: 10 }] }],
    ['weights', { weights: [{ date: 'hier', kg: 80 }] }],
    ['activity', { activity: 1.5 }],
    ['goal', { goal: 'bulk' }],
    ['goalAdjustPct', { goalAdjustPct: -50 }],
    ['goalAdjustPct', { goalAdjustPct: null }],
    ['weighInEveryDays', { weighInEveryDays: 0 }],
    ['weighInEveryDays', { weighInEveryDays: 7.5 }],
    ['proteinPerKg', { proteinPerKg: 5 }],
    ['fatPerKg', { fatPerKg: 0.1 }],
  ];
  for (const [field, patch] of cases) {
    it(`signale ${field} pour ${JSON.stringify(patch)}`, () => {
      const errors = validateProfile({ ...briefProfile(), ...patch }, TODAY);
      assert.equal(errors.length, 1, JSON.stringify(errors));
      assert.equal(errors[0].field, field);
      assert.match(errors[0].message, /\S/);
    });
  }
  it('le prénom est facultatif', () => {
    assert.deepEqual(validateProfile({ ...briefProfile(), name: '' }, TODAY), []);
    assert.deepEqual(validateProfile({ ...briefProfile(), name: 'Katrina' }, TODAY), []);
  });
  it('les surcharges g/kg à null sont acceptées', () => {
    assert.deepEqual(validateProfile({ ...briefProfile(), proteinPerKg: null, fatPerKg: null }, TODAY), []);
  });
  it('profil absent', () => {
    assert.equal(validateProfile(null, TODAY)[0].field, 'profile');
  });
});

describe('targetsForProfile', () => {
  it('résout âge et poids courant puis calcule les cibles du brief', () => {
    const t = targetsForProfile(briefProfile(), TODAY);
    assert.equal(t.ageYears, 36);
    assert.equal(t.weightKg, 80);
    assert.equal(t.kcal, 2306);
    assert.equal(t.proteinG, 144);
    assert.equal(t.fatG, 72);
    assert.equal(t.carbsG, 271);
    assert.equal(t.dailyPoints, 31.5);
    assert.equal(t.weeklyPoints, 242.5);
  });
  it('utilise la dernière pesée et se recalcule après une nouvelle pesée', () => {
    const p = addWeighIn(briefProfile(), { date: '2026-09-19', kg: 75 });
    const t = targetsForProfile(p, '2026-09-19');
    assert.equal(t.weightKg, 75);
    assert.equal(t.bmr, 1700);
    assert.equal(t.proteinG, 135);
  });
  it('surcharges g/kg du profil transmises', () => {
    const t = targetsForProfile({ ...briefProfile(), proteinPerKg: 2.2 }, TODAY);
    assert.equal(t.proteinG, 176);
  });
  it('profil invalide → null', () => {
    assert.equal(targetsForProfile(newProfile(), TODAY), null);
  });
});

describe('weighInStatus', () => {
  it('sans pesée → null', () => {
    assert.equal(weighInStatus(newProfile(), TODAY), null);
  });
  it('pesée du jour : rien à faire, prochaine dans 14 jours', () => {
    const s = weighInStatus(briefProfile(), TODAY);
    assert.equal(s.due, false);
    assert.equal(s.daysSince, 0);
    assert.equal(s.daysLeft, 14);
    assert.equal(s.nextDate, '2026-09-19');
    assert.equal(s.lastDate, '2026-09-05');
  });
  it('à l’échéance, l’invite est due', () => {
    const s = weighInStatus(newProfile({ weights: [{ date: '2026-08-22', kg: 80 }] }), TODAY);
    assert.equal(s.due, true);
    assert.equal(s.daysSince, 14);
    assert.equal(s.daysLeft, 0);
    assert.equal(s.nextDate, '2026-09-05');
  });
  it('en retard : compte les jours depuis la dernière pesée', () => {
    const s = weighInStatus(newProfile({ weights: [{ date: '2026-08-01', kg: 80 }] }), TODAY);
    assert.equal(s.due, true);
    assert.equal(s.daysSince, 35);
  });
  it('respecte la fréquence du profil', () => {
    const s = weighInStatus(newProfile({ weighInEveryDays: 7, weights: [{ date: '2026-09-01', kg: 80 }] }), TODAY);
    assert.equal(s.everyDays, 7);
    assert.equal(s.due, false);
    assert.equal(s.daysLeft, 3);
    assert.equal(s.nextDate, '2026-09-08');
  });
  it('part de la pesée la plus récente, quel que soit l’ordre', () => {
    const s = weighInStatus(newProfile({ weights: [{ date: '2026-09-03', kg: 80 }, { date: '2026-07-01', kg: 83 }] }), TODAY);
    assert.equal(s.lastDate, '2026-09-03');
    assert.equal(s.daysSince, 2);
  });
});
