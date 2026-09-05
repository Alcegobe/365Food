/**
 * Icônes SVG inline (traits 1,8 px, bouts arrondis), colorées par `currentColor`.
 */
import { raw } from './dom.js';

const PATHS = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none"/>',
  egg: '<path d="M12 3c3.5 0 6.5 5.2 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.2 8.5 3 12 3z"/>',
  drop: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
  leaf: '<path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z"/><path d="M4 20 20 4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12a4 4 0 0 1 8 0"/><path d="m12 12 2-2.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  alert: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>',
};

/** Retourne le SVG d'une icône, prêt à être interpolé dans un gabarit `html`. */
export function icon(name) {
  const body = PATHS[name];
  if (!body) return raw('');
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`,
  );
}
