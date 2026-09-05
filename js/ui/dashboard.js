/**
 * Tableau de bord : identité, titre du jour, tuiles (poids, macros, semaine), pesées, profil, données.
 */
import { GOALS, PROFILE_LIMITS } from '../config.js';
import { activityLevel } from '../nutrition.js';
import { currentWeighIn, todayISO } from '../profile.js';
import { fmt, html, render } from './dom.js';
import { icon } from './icons.js';

const PILL_SLOTS = 7;

/** Initiales (2 lettres max) d'un prénom / nom, ou chaîne vide. */
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.slice(0, 2).map((w) => w[0].toLocaleUpperCase('fr')).join('');
}

/**
 * Graphique en pilules des 7 dernières pesées (ordre chronologique).
 * La hauteur de la barre situe le poids entre le minimum et le maximum de la période.
 */
function weightPills(weights) {
  const asc = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-PILL_SLOTS);
  const kgs = asc.map((w) => w.kg);
  const min = Math.min(...kgs);
  const span = Math.max(...kgs) - min;
  const heightPct = (kg) => {
    const ratio = span < 0.1 ? 0.5 : (kg - min) / span;
    return Math.round(45 + ratio * 43);
  };
  const empties = PILL_SLOTS - asc.length;
  const pills = [
    ...Array.from({ length: empties }, () => html`<div class="pill pill--empty"><span class="pill__cap"></span></div>`),
    ...asc.map(
      (w) => html`<div class="pill" title="${fmt.date(w.date)} : ${fmt.kg(w.kg)}"><span class="pill__cap"></span><span class="pill__bar" style="height: ${heightPct(w.kg)}%"></span></div>`,
    ),
  ];
  const labels = [
    ...Array.from({ length: empties }, () => html`<span>·</span>`),
    ...asc.map((w) => html`<span>${fmt.dayMonth(w.date)}</span>`),
  ];
  const description = `Poids des dernières pesées : ${asc.map((w) => `${fmt.date(w.date)} ${fmt.kg(w.kg)}`).join(', ')}.`;
  return { pills, labels, description };
}

function statTile({ key, label, iconName, value, unit, wide = false, hint = '' }) {
  return html`
    <article class="tile ${wide ? 'tile--wide' : ''}" data-stat="${key}">
      <p class="tile__label">${icon(iconName)} ${label}</p>
      <p class="tile__value">${value} <small>${unit}</small></p>
      ${hint ? html`<p class="tile__hint">${hint}</p>` : ''}
    </article>
  `;
}

export function renderDashboard(container, { profile, targets, today = new Date() }) {
  const todayIso = todayISO(today);
  const current = currentWeighIn(profile);
  const goal = GOALS[targets.goal];
  const level = activityLevel(targets.activityFactor);
  const history = [...profile.weights].sort((a, b) => b.date.localeCompare(a.date));
  const recent = history.slice(0, 6);
  const chart = weightPills(profile.weights);
  const name = String(profile.name ?? '').trim();
  const pointsWord = targets.dailyPoints >= 2 ? 'points' : 'point';

  render(
    container,
    html`
      <header class="identity">
        <div class="avatar" aria-hidden="true">${initials(name) || icon('person')}</div>
        <div>
          <p class="identity__name">${name || 'Ton profil'}</p>
          <p class="identity__meta">${targets.ageYears} ans · ${fmt.kg(targets.weightKg)}</p>
        </div>
      </header>

      <h2 class="headline">Aujourd'hui, tu as <span class="headline__num">${fmt.dec(targets.dailyPoints)}</span> ${pointsWord} à savourer</h2>
      <p class="subline">
        <span class="subline__date">${fmt.weekdayDate(todayIso)}</span> · ${fmt.int(targets.kcal)} kcal · P ${fmt.int(targets.proteinG)} g ·
        L ${fmt.int(targets.fatG)} g · G ${fmt.int(targets.carbsG)} g
      </p>

      ${targets.belowFloor
        ? html`
            <div class="alert" role="alert">
              <span class="alert__icon">${icon('alert')}</span>
              <p>
                Ta cible calculée (${fmt.kcal(Math.round(targets.rawKcal))}) passait sous le plancher de sécurité.
                Elle a été relevée à <strong>${fmt.kcal(targets.floor)}</strong>. Réduis le déficit ou vérifie ton profil.
              </p>
            </div>
          `
        : ''}
      ${targets.carbsClamped
        ? html`
            <div class="alert" role="alert">
              <span class="alert__icon">${icon('alert')}</span>
              <p>Avec ces quantités de protéines et de lipides, il ne reste plus de place pour les glucides. Baisse les g/kg dans les réglages avancés.</p>
            </div>
          `
        : ''}

      <div class="tiles">
        <article class="tile tile--wide tile--tall tile--white" aria-labelledby="weight-chart-title">
          <div class="tile__head">
            <p class="tile__label" id="weight-chart-title">${icon('scale')} Poids</p>
            <p class="tile__value">${fmt.dec(current.kg)} <small>kg</small></p>
          </div>
          <div class="pills" role="img" aria-label="${chart.description}">${chart.pills}</div>
          <div class="pills__labels" aria-hidden="true">${chart.labels}</div>
        </article>
        ${statTile({ key: 'kcal', label: 'Énergie', iconName: 'bolt', value: fmt.int(targets.kcal), unit: 'kcal' })}
        ${statTile({ key: 'protein', label: 'Protéines', iconName: 'egg', value: fmt.int(targets.proteinG), unit: 'g' })}
        ${statTile({ key: 'fat', label: 'Lipides', iconName: 'drop', value: fmt.int(targets.fatG), unit: 'g' })}
        ${statTile({ key: 'carbs', label: 'Glucides', iconName: 'leaf', value: fmt.int(targets.carbsG), unit: 'g' })}
      </div>

      <div class="grid">
        <div class="grid__col">
          ${statTile({
            key: 'week',
            label: 'Cette semaine',
            iconName: 'calendar',
            value: fmt.dec(targets.weeklyPoints),
            unit: 'points',
            hint: `7 × ${fmt.dec(targets.dailyPoints)} + 10 % de jokers pour un resto ou une soirée. Fibres : ${targets.fiberMinG} à ${targets.fiberMaxG} g par jour.`,
          })}
          <section class="tile" aria-labelledby="weight-title">
            <h3 class="tile__title" id="weight-title">Pesées</h3>
            <form id="weigh-in-form" class="inline-form" novalidate>
              <div class="field">
                <label class="field__label" for="w-kg">Poids</label>
                <div class="with-unit">
                  <input class="input" id="w-kg" name="kg" type="number" step="0.1" inputmode="decimal" required
                         min="${PROFILE_LIMITS.weightKg.min}" max="${PROFILE_LIMITS.weightKg.max}" placeholder="${fmt.dec(current.kg)}">
                  <span class="with-unit__unit" aria-hidden="true">kg</span>
                </div>
              </div>
              <div class="field">
                <label class="field__label" for="w-date">Date</label>
                <input class="input" id="w-date" name="date" type="date" value="${todayIso}" max="${todayIso}" required>
              </div>
              <button type="submit" class="icon-btn icon-btn--dark" aria-label="Ajouter la pesée">${icon('plus')}</button>
            </form>
            <ol class="weigh-list" aria-label="Dernières pesées">
              ${recent.map((entry, i) => {
                const previous = history[i + 1];
                const delta = previous ? entry.kg - previous.kg : null;
                return html`
                  <li>
                    <span>${fmt.date(entry.date)}</span>
                    <strong>${fmt.kg(entry.kg)}</strong>
                    <span class="delta">${delta === null ? '' : Math.abs(delta) < 0.05 ? '=' : fmt.signed(Math.round(delta * 10) / 10, ' kg')}</span>
                    <button type="button" class="icon-btn icon-btn--soft" data-action="delete-weigh-in" data-date="${entry.date}"
                            aria-label="Supprimer la pesée du ${fmt.date(entry.date)}">${icon('close')}</button>
                  </li>
                `;
              })}
            </ol>
            ${history.length > recent.length ? html`<p class="muted small">${history.length} pesées au total, les ${recent.length} dernières sont affichées.</p>` : ''}
          </section>
        </div>

        <div class="grid__col">
          <section class="tile" aria-labelledby="profile-title">
            <h3 class="tile__title" id="profile-title">Ton profil</h3>
            <dl class="dl">
              <div><dt>Âge</dt><dd>${targets.ageYears} ans</dd></div>
              <div><dt>Taille</dt><dd>${fmt.int(targets.heightCm)} cm</dd></div>
              <div><dt>Poids</dt><dd>${fmt.kg(targets.weightKg)} <span class="muted small">le ${fmt.dateShort(current.date)}</span></dd></div>
              <div><dt>Activité</dt><dd>${level ? level.label : targets.activityFactor} <span class="muted small">× ${fmt.dec2(targets.activityFactor)}</span></dd></div>
              <div><dt>Objectif</dt><dd>${goal.label} <span class="muted small">${fmt.signed(targets.goalAdjustPct, ' %')}</span></dd></div>
              <div><dt>Métabolisme de base</dt><dd>${fmt.kcal(Math.round(targets.bmr))}</dd></div>
              <div><dt>Dépense journalière</dt><dd>${fmt.kcal(Math.round(targets.tdee))}</dd></div>
              <div><dt>Protéines · lipides</dt><dd>${fmt.dec2(targets.proteinPerKg)} · ${fmt.dec2(targets.fatPerKg)} g/kg</dd></div>
              <div><dt>Rappel de pesée</dt><dd>tous les ${profile.weighInEveryDays} jours</dd></div>
            </dl>
            <div class="btn-row">
              <button type="button" class="btn btn--primary" data-action="edit-profile">Modifier le profil</button>
            </div>
          </section>

          <section class="tile" aria-labelledby="data-title">
            <h3 class="tile__title" id="data-title">Tes données</h3>
            <p class="muted">Tout est stocké dans ce navigateur. Exporte une sauvegarde pour changer d'appareil ou par sécurité.</p>
            <div class="btn-row">
              <button type="button" class="btn" data-action="export">${icon('download')} Exporter</button>
              <button type="button" class="btn" data-action="import">${icon('upload')} Importer</button>
              <button type="button" class="btn btn--danger" data-action="reset">${icon('trash')} Tout effacer</button>
            </div>
          </section>
        </div>
      </div>
    `,
  );
}
