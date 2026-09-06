/**
 * Apparence (V4) : réglage « automatique / clair / sombre » de l'utilisateur.
 * La partie pure (normalisation, résolution) est testée ; applyTheme touche le DOM
 * (attribut `data-theme` sur <html>, couleur de la barre du navigateur).
 */
import { THEMES } from './config.js';

export const DEFAULT_THEME = 'auto';

/** Couleur de la barre du navigateur par thème effectif (= --bg-a dans css/app.css). */
export const THEME_COLORS = Object.freeze({ light: '#e4eeea', dark: '#181e1c' });

/** Ramène une valeur quelconque à un réglage connu. */
export function normalizeTheme(value) {
  return typeof value === 'string' && Object.hasOwn(THEMES, value) ? value : DEFAULT_THEME;
}

/** Thème effectif ('light' | 'dark') pour un réglage et la préférence du système. */
export function resolveTheme(setting, prefersDark = false) {
  const theme = normalizeTheme(setting);
  if (theme === 'auto') return prefersDark ? 'dark' : 'light';
  return theme;
}

/**
 * Applique le réglage au document : `data-theme` forcé (clair / sombre) ou retiré (automatique),
 * et couleur de la barre du navigateur. En automatique, les deux balises theme-color à `media`
 * reprennent chacune leur couleur.
 */
export function applyTheme(setting, doc = document) {
  const theme = normalizeTheme(setting);
  const root = doc.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
    const own = /dark/.test(meta.getAttribute('media') ?? '') ? 'dark' : 'light';
    meta.setAttribute('content', THEME_COLORS[theme === 'auto' ? own : theme]);
  }
  return theme;
}
