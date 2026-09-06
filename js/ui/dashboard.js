/**
 * Tableau de bord : identité, titre du jour, tuiles (poids, macros, semaine), pesées, profil, données.
 */
import { GOALS, PLANNER_SLOTS, PROFILE_LIMITS, THEMES } from '../config.js';
import { activityLevel } from '../nutrition.js';
import { dayItems, dayTotals } from '../planner.js';
import { weightCurve } from '../charts.js';
import { currentWeighIn, todayISO, weighInStatus } from '../profile.js';
import { fmt, gauge, html, render } from './dom.js';
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

/** Courbe de l'historique complet (à partir de deux pesées). */
function curveFigure(curve) {
  if (!curve) return '';
  const area = `${curve.path} L ${curve.last.x} ${curve.height} L ${curve.first.x} ${curve.height} Z`;
  const description = `Courbe du poids du ${fmt.date(curve.first.date)} au ${fmt.date(curve.last.date)}, de ${fmt.kg(curve.min)} à ${fmt.kg(curve.max)}.`;
  return html`
    <figure class="curve" role="img" aria-label="${description}">
      <svg viewBox="0 0 ${curve.width} ${curve.height}" aria-hidden="true" focusable="false">
        <path class="curve__area" d="${area}"></path>
        <path class="curve__line" d="${curve.path}"></path>
        ${curve.points.map((p, i) => html`<circle class="curve__dot ${i === curve.points.length - 1 ? 'curve__dot--last' : ''}" cx="${p.x}" cy="${p.y}" r="3"></circle>`)}
      </svg>
      <figcaption class="curve__labels" aria-hidden="true">
        <span>${fmt.dayMonth(curve.first.date)}</span>
        <span>${fmt.dec(curve.min)} à ${fmt.dec(curve.max)} kg</span>
        <span>${fmt.dayMonth(curve.last.date)}</span>
      </figcaption>
    </figure>
  `;
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

/** Tuile « Au menu aujourd'hui » : repas planifiés et jauges du jour. */
function menuTile({ planner, catalog, todayIso, targets }) {
  if (!catalog) {
    return html`<article class="tile tile--full" data-stat="menu"><p class="tile__label">${icon('planner')} Au menu</p><p class="muted">Chargement…</p></article>`;
  }
  const items = dayItems(planner, todayIso);
  const totals = dayTotals(planner, todayIso, catalog.nutritionById);
  const byId = new Map(catalog.recipes.map((r) => [r.id, r]));
  const slotLabel = Object.fromEntries(PLANNER_SLOTS.map((s) => [s.id, s.label]));
  return html`
    <article class="tile tile--full tile--white" data-stat="menu">
      <div class="tile__head">
        <p class="tile__label">${icon('planner')} Au menu aujourd'hui</p>
        <a class="btn" href="#/planning">Planning</a>
      </div>
      ${items.length === 0
        ? html`<p class="muted">Rien de planifié.</p>`
        : html`
            <ul class="menu-list">
              ${items.map((item) => {
                const recipe = byId.get(item.recipeId);
                const n = catalog.nutritionById.get(item.recipeId);
                return html`
                  <li>
                    <span class="slot-tag">${slotLabel[item.slot] ?? item.slot}</span>
                    ${recipe ? html`<a href="#/recettes/${encodeURIComponent(recipe.id)}">${recipe.title}${item.portions > 1 ? ` × ${item.portions}` : ''}${item.leftoverOf ? ' (restes)' : ''}</a>` : html`<span>${item.recipeId}</span>`}
                    <span class="pts">${n ? `${fmt.dec(n.points * item.portions)} pts` : ''}</span>
                  </li>
                `;
              })}
            </ul>
          `}
      <div class="menu-gauges">
        ${gauge({ value: totals.points, max: targets.dailyPoints, label: 'Points', unit: 'pts' })}
        ${gauge({ value: totals.protein, max: targets.proteinG, label: 'Protéines', unit: 'g' })}
      </div>
    </article>
  `;
}

export function renderDashboard(container, { profile, targets, planner, catalog = null, theme = 'auto', installAvailable = false, today = new Date() }) {
  const todayIso = todayISO(today);
  const consumed = catalog ? dayTotals(planner, todayIso, catalog.nutritionById) : null;
  const remaining = consumed ? Math.max(0, targets.dailyPoints - consumed.points) : null;
  const current = currentWeighIn(profile);
  const goal = GOALS[targets.goal];
  const level = activityLevel(targets.activityFactor);
  const history = [...profile.weights].sort((a, b) => b.date.localeCompare(a.date));
  const recent = history.slice(0, 6);
  const chart = weightPills(profile.weights);
  const reminder = weighInStatus(profile, today);
  const curve = weightCurve(profile.weights);
  const name = String(profile.name ?? '').trim();
  const headlinePoints = consumed && consumed.items > 0 ? remaining : targets.dailyPoints;
  const pointsWord = headlinePoints >= 2 ? 'points' : 'point';

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

      <h2 class="headline">${consumed && consumed.items > 0
        ? html`Aujourd'hui, il te reste <span class="headline__num">${fmt.dec(remaining)}</span> ${pointsWord}`
        : html`Aujourd'hui, tu as <span class="headline__num">${fmt.dec(targets.dailyPoints)}</span> ${pointsWord} à savourer`}</h2>
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
      ${reminder?.due
        ? html`
            <section class="tile tile--white prompt" aria-labelledby="weigh-prompt-title">
              <div class="prompt__text">
                <h3 class="tile__title" id="weigh-prompt-title">Quel est ton poids aujourd'hui ?</h3>
                <p class="tile__hint">Dernière pesée il y a ${reminder.daysSince} ${reminder.daysSince > 1 ? 'jours' : 'jour'}.</p>
              </div>
              <form id="weigh-in-prompt" class="inline-form" novalidate>
                <div class="field">
                  <label class="visually-hidden" for="wp-kg">Poids</label>
                  <div class="with-unit">
                    <input class="input" id="wp-kg" name="kg" type="number" step="0.1" inputmode="decimal" required
                           min="${PROFILE_LIMITS.weightKg.min}" max="${PROFILE_LIMITS.weightKg.max}" placeholder="${fmt.dec(current.kg)}">
                    <span class="with-unit__unit" aria-hidden="true">kg</span>
                  </div>
                </div>
                <input type="hidden" name="date" value="${todayIso}">
                <button type="submit" class="btn btn--primary">Enregistrer</button>
              </form>
            </section>
          `
        : ''}

      <div class="tiles">
        ${menuTile({ planner, catalog, todayIso, targets })}
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
            hint: `7 × ${fmt.dec(targets.dailyPoints)} + 10 % de jokers.`,
          })}
          <section class="tile" aria-labelledby="weight-title">
            <div class="tile__head">
              <h3 class="tile__title" id="weight-title">Pesées</h3>
              ${reminder ? html`<p class="tile__hint">${reminder.due ? "À faire aujourd'hui" : `Prochaine le ${fmt.dateShort(reminder.nextDate)}`}</p>` : ''}
            </div>
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
            ${curveFigure(curve)}
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
              <a class="btn btn--primary" href="#/profil">Modifier le profil</a>
            </div>
          </section>

          <section class="tile" aria-labelledby="app-title">
            <h3 class="tile__title" id="app-title">Application</h3>
            <div class="field">
              <span class="field__label" id="theme-label">Apparence</span>
              <div class="chips" role="group" aria-labelledby="theme-label">
                ${Object.entries(THEMES).map(
                  ([id, label]) => html`<button type="button" class="chip" data-action="theme" data-theme="${id}" aria-pressed="${theme === id}">${label}</button>`,
                )}
              </div>
            </div>
            ${installAvailable
              ? html`<div class="btn-row"><button type="button" class="btn btn--primary" data-action="install">${icon('download')} Installer sur l'appareil</button></div>`
              : ''}
          </section>

          <section class="tile" aria-labelledby="data-title">
            <h3 class="tile__title" id="data-title">Données</h3>
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
