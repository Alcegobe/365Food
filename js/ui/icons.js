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
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  minus: '<path d="M5 12h14"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20c0-3-2-5.2-4.5-5.8"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  cart: '<path d="M3 4h2l2.4 11.5a1 1 0 0 0 1 .8H18a1 1 0 0 0 1-.8L21 8H6.5"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>',
  leftover: '<path d="M4 12a8 8 0 1 1 2.3 5.7"/><path d="M4 18v-5h5"/>',
  planner: '<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3M13 14h3M8 17.5h3"/>',
};

/** Retourne le SVG d'une icône, prêt à être interpolé dans un gabarit `html`. */
export function icon(name) {
  const body = PATHS[name];
  if (!body) return raw('');
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`,
  );
}
