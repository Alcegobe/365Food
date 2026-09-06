/**
 * Courbe simple de l'historique de poids (brief §2.1) : coordonnées SVG prêtes à tracer.
 * Fonction pure : x proportionnel au temps écoulé, y inversé (en haut = le poids le plus élevé).
 */
import { parseDateParts } from './nutrition.js';

function dayNumber(iso) {
  const p = parseDateParts(iso);
  return p ? Date.UTC(p.y, p.m - 1, p.d) / 86400000 : null;
}

/**
 * Retourne null s'il y a moins de deux pesées valides, sinon
 * { width, height, points: [{ date, kg, x, y }], path, min, max, first, last }.
 */
export function weightCurve(weights, { width = 320, height = 110, padX = 8, padY = 12 } = {}) {
  const valid = (Array.isArray(weights) ? weights : [])
    .filter((w) => w && Number.isFinite(w.kg) && dayNumber(w.date) !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length < 2) return null;

  const days = valid.map((w) => dayNumber(w.date));
  const kgs = valid.map((w) => w.kg);
  const firstDay = days[0];
  const span = days[days.length - 1] - firstDay;
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;
  const round = (n) => Math.round(n * 10) / 10;

  const points = valid.map((w, i) => ({
    date: w.date,
    kg: w.kg,
    x: round(padX + (span === 0 ? innerW / 2 : ((days[i] - firstDay) / span) * innerW)),
    y: round(padY + (range === 0 ? innerH / 2 : ((max - w.kg) / range) * innerH)),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return { width, height, points, path, min, max, first: points[0], last: points[points.length - 1] };
}
