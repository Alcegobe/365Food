import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { weightCurve } from '../js/charts.js';

describe('weightCurve', () => {
  it('moins de deux pesées → null', () => {
    assert.equal(weightCurve([]), null);
    assert.equal(weightCurve([{ date: '2026-09-05', kg: 80 }]), null);
    assert.equal(weightCurve(null), null);
  });

  it('place la première pesée à gauche, la dernière à droite, le poids le plus haut en haut', () => {
    const c = weightCurve([{ date: '2026-09-01', kg: 82 }, { date: '2026-09-15', kg: 80 }], { width: 320, height: 110, padX: 8, padY: 12 });
    assert.equal(c.first.x, 8);
    assert.equal(c.last.x, 312);
    assert.equal(c.first.y, 12);
    assert.equal(c.last.y, 98);
    assert.equal(c.min, 80);
    assert.equal(c.max, 82);
    assert.equal(c.path, 'M 8 12 L 312 98');
  });

  it('x est proportionnel au temps écoulé', () => {
    const c = weightCurve([{ date: '2026-09-01', kg: 80 }, { date: '2026-09-06', kg: 81 }, { date: '2026-09-21', kg: 79 }], { width: 208, padX: 4 });
    assert.equal(c.points[1].x, 4 + 200 / 4);
  });

  it('poids constant → ligne à mi-hauteur', () => {
    const c = weightCurve([{ date: '2026-09-01', kg: 80 }, { date: '2026-09-08', kg: 80 }], { height: 100, padY: 10 });
    assert.equal(c.first.y, 50);
    assert.equal(c.last.y, 50);
  });

  it('trie par date et ignore les entrées invalides', () => {
    const c = weightCurve([{ date: '2026-09-15', kg: 79 }, { date: 'n/a', kg: 70 }, { date: '2026-09-01', kg: 81 }, { date: '2026-09-08' }]);
    assert.deepEqual(c.points.map((p) => p.date), ['2026-09-01', '2026-09-15']);
    assert.equal(c.first.kg, 81);
    assert.equal(c.last.kg, 79);
  });
});
