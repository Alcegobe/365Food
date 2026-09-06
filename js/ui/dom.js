/**
 * Petits utilitaires DOM : gabarits HTML échappés, formats français, toast, fichiers.
 */
import { parseDateParts } from '../nutrition.js';

/** Fragment HTML déjà sûr (ne sera pas ré-échappé). */
class Html {
  constructor(text) {
    this.text = text;
  }

  toString() {
    return this.text;
  }
}

export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toHtml(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Html) return value.text;
  if (Array.isArray(value)) return value.map(toHtml).join('');
  return esc(value);
}

/** Marque une chaîne comme HTML sûr. */
export function raw(text) {
  return new Html(String(text));
}

/** Gabarit HTML : toute valeur interpolée est échappée, sauf les fragments `html`/`raw`. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += toHtml(value) + strings[i + 1];
  });
  return new Html(out);
}

export function render(container, content) {
  container.innerHTML = toHtml(content);
}

/* ---------- Formats (fr-BE, unités métriques) ---------- */

const LOCALE = 'fr-BE';
const intFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const dec2Format = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const longDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
const weekdayDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit' });

function toLocalDate(iso) {
  const parts = parseDateParts(iso);
  return parts ? new Date(parts.y, parts.m - 1, parts.d) : null;
}

export const fmt = {
  int: (n) => intFormat.format(n),
  dec: (n) => decFormat.format(n),
  dec2: (n) => dec2Format.format(n),
  kcal: (n) => `${intFormat.format(n)} kcal`,
  g: (n) => `${intFormat.format(n)} g`,
  kg: (n) => `${decFormat.format(n)} kg`,
  points: (n) => `${decFormat.format(n)} ${n >= 2 ? 'points' : 'point'}`,
  signed: (n, unit = '') => `${n > 0 ? '+' : ''}${decFormat.format(n)}${unit}`,
  date: (iso) => (toLocalDate(iso) ? longDate.format(toLocalDate(iso)) : String(iso)),
  dateShort: (iso) => (toLocalDate(iso) ? shortDate.format(toLocalDate(iso)) : String(iso)),
  weekdayDate: (iso) => (toLocalDate(iso) ? weekdayDate.format(toLocalDate(iso)) : String(iso)),
  dayMonth: (iso) => (toLocalDate(iso) ? dayMonth.format(toLocalDate(iso)) : String(iso)),
};

/* ---------- Jauge ---------- */

/** Barre de progression : consommé / budget, saturée à 100 %, rouge au-delà. */
export function gauge({ value, max, label, unit }) {
  const ratio = max > 0 ? value / max : 0;
  const width = Math.min(100, Math.round(ratio * 100));
  return html`
    <div class="gauge ${ratio > 1 ? 'gauge--over' : ''}">
      <div class="gauge__text"><span>${label}</span><span class="gauge__nums">${fmt.dec(value)} / ${fmt.dec(max)} ${unit}</span></div>
      <div class="gauge__track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}">
        <span class="gauge__bar" style="width: ${width}%"></span>
      </div>
    </div>
  `;
}

/* ---------- Toast ---------- */

let toastTimer = 0;

export function toast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--visible'), type === 'error' ? 7000 : 3500);
}

/* ---------- Fichiers ---------- */

export function downloadTextFile(fileName, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file) {
  return file.text();
}
