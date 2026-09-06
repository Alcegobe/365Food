import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_THEME, THEME_COLORS, applyTheme, normalizeTheme, resolveTheme } from '../js/theme.js';
import { THEMES } from '../js/config.js';

/** Doublure minimale de document pour applyTheme. */
function fakeDocument() {
  const attrs = {};
  const metas = [
    { media: '(prefers-color-scheme: light)', content: 'x' },
    { media: '(prefers-color-scheme: dark)', content: 'x' },
  ].map((m) => ({
    getAttribute: (name) => m[name] ?? null,
    setAttribute: (name, value) => { m[name] = value; },
    data: m,
  }));
  return {
    attrs,
    metas,
    documentElement: {
      setAttribute: (name, value) => { attrs[name] = value; },
      removeAttribute: (name) => { delete attrs[name]; },
    },
    querySelectorAll: () => metas,
  };
}

describe('apparence (V4)', () => {
  it('trois réglages connus, « auto » par défaut', () => {
    assert.deepEqual(Object.keys(THEMES), ['auto', 'light', 'dark']);
    assert.equal(DEFAULT_THEME, 'auto');
    assert.equal(normalizeTheme('dark'), 'dark');
    assert.equal(normalizeTheme('light'), 'light');
    assert.equal(normalizeTheme('sépia'), 'auto');
    assert.equal(normalizeTheme(undefined), 'auto');
    assert.equal(normalizeTheme(42), 'auto');
  });
  it('résolution : auto suit le système, sinon le réglage', () => {
    assert.equal(resolveTheme('auto', true), 'dark');
    assert.equal(resolveTheme('auto', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
    assert.equal(resolveTheme('n’importe quoi', true), 'dark');
  });
  it('applyTheme pose ou retire data-theme et règle les theme-color', () => {
    const doc = fakeDocument();
    assert.equal(applyTheme('dark', doc), 'dark');
    assert.equal(doc.attrs['data-theme'], 'dark');
    assert.deepEqual(doc.metas.map((m) => m.data.content), [THEME_COLORS.dark, THEME_COLORS.dark]);

    applyTheme('auto', doc);
    assert.equal(doc.attrs['data-theme'], undefined);
    assert.deepEqual(doc.metas.map((m) => m.data.content), [THEME_COLORS.light, THEME_COLORS.dark]);

    applyTheme('light', doc);
    assert.equal(doc.attrs['data-theme'], 'light');
    assert.deepEqual(doc.metas.map((m) => m.data.content), [THEME_COLORS.light, THEME_COLORS.light]);
  });
});
