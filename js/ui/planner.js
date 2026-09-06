/**
 * Planning : semaine par jours et créneaux, jauges, restes du midi, liste de courses, sélecteur de recette.
 */
import { PLANNER_LIMITS, PLANNER_SLOTS, RECIPE_CATEGORIES } from '../config.js';
import { addDays, dayPlan, dayTotals, leftoverCandidates, shoppingChecked, shoppingList, weekStart, weekTotals } from '../planner.js';
import { fmt, gauge, html, render } from './dom.js';
import { icon } from './icons.js';

const WEEKDAY = new Intl.DateTimeFormat('fr-BE', { weekday: 'long' });
const DAY_MONTH_SHORT = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' });
const DAY_MONTH_LONG = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' });

function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}

/** « Semaine du 7 au 13 septembre » (ou avec deux mois). */
export function weekLabel(dates) {
  const first = localDate(dates[0]);
  const last = localDate(dates[6]);
  if (first.getMonth() === last.getMonth()) return `Semaine du ${first.getDate()} au ${DAY_MONTH_LONG.format(last)}`;
  return `Semaine du ${DAY_MONTH_LONG.format(first)} au ${DAY_MONTH_LONG.format(last)}`;
}

/** Quantité lisible pour la liste de courses. */
export function shoppingQuantity(item) {
  if (item.pieces !== null && item.pieces !== undefined) {
    const n = Math.max(1, Math.ceil(item.pieces - 0.05));
    const name = item.pieceName ?? 'pièce';
    const plural = n >= 2 && !name.endsWith('s') && !name.endsWith('x') ? `${name}s` : name;
    return `${fmt.int(n)} ${plural} (${fmt.int(item.grams)} g)`;
  }
  if (item.ml !== null && item.ml !== undefined) return `${fmt.int(item.ml)} ml`;
  return `${fmt.int(item.grams)} g`;
}

function planItem({ date, item, recipe, nutrition }) {
  const title = recipe?.title ?? item.recipeId;
  const pts = nutrition ? nutrition.points * item.portions : null;
  return html`
    <li class="plan-item ${item.leftoverOf ? 'plan-item--leftover' : ''}">
      <div class="plan-item__main">
        ${recipe ? html`<a class="plan-item__title" href="#/recettes/${encodeURIComponent(recipe.id)}">${title}</a>` : html`<span class="plan-item__title">${title}</span>`}
        <span class="plan-item__meta">${item.leftoverOf ? html`${icon('leftover')} restes · ` : ''}${pts === null ? '' : `${fmt.dec(pts)} pts`}${nutrition ? ` · P ${fmt.int(nutrition.perPortion.protein * item.portions)} g` : ''}</span>
      </div>
      <div class="plan-item__controls">
        <span class="stepper stepper--small" role="group" aria-label="Portions">
          <button type="button" data-action="plan-portions" data-date="${date}" data-item="${item.id}" data-delta="-1" aria-label="Une portion de moins" ${item.portions <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
          <output>${item.portions}</output>
          <button type="button" data-action="plan-portions" data-date="${date}" data-item="${item.id}" data-delta="1" aria-label="Une portion de plus" ${item.portions >= PLANNER_LIMITS.maxPortions ? 'disabled' : ''}>${icon('plus')}</button>
        </span>
        <button type="button" class="icon-btn icon-btn--soft" data-action="plan-remove" data-date="${date}" data-item="${item.id}" aria-label="Retirer ${title}">${icon('close')}</button>
      </div>
    </li>
  `;
}

export function renderPlanner(container, { planner, dates, today, catalog, targets }) {
  const weekKey = weekStart(dates[0]);
  const byId = new Map(catalog.recipes.map((r) => [r.id, r]));
  const totals = weekTotals(planner, dates, catalog.nutritionById);
  const list = shoppingList(planner, dates, catalog);
  const checked = shoppingChecked(planner, weekKey);
  const isCurrentWeek = weekStart(today) === weekKey;

  render(
    container,
    html`
      <div class="planner__top">
        <div>
          <h2 class="headline">Planning</h2>
          <p class="subline">${weekLabel(dates)}</p>
        </div>
        <div class="btn-row planner__nav">
          <button type="button" class="icon-btn" data-action="week-prev" aria-label="Semaine précédente">${icon('chevronLeft')}</button>
          <button type="button" class="btn" data-action="week-today" ${isCurrentWeek ? 'disabled' : ''}>Cette semaine</button>
          <button type="button" class="icon-btn" data-action="week-next" aria-label="Semaine suivante">${icon('chevronRight')}</button>
          <button type="button" class="btn" data-action="print-week">${icon('print')} Imprimer</button>
        </div>
      </div>

      <section class="tile tile--white week-summary" aria-labelledby="week-summary-title">
        <div class="tile__head">
          <p class="tile__label" id="week-summary-title">${icon('calendar')} Semaine</p>
          <p class="tile__value">${fmt.dec(totals.points)} <small>/ ${fmt.dec(targets.weeklyPoints)} pts</small></p>
        </div>
        ${gauge({ value: totals.points, max: targets.weeklyPoints, label: 'Points', unit: 'pts' })}
        <p class="tile__hint">${totals.items} ${totals.items > 1 ? 'repas planifiés' : 'repas planifié'} sur ${totals.plannedDays} ${totals.plannedDays > 1 ? 'jours' : 'jour'}.</p>
      </section>

      <div class="week">
        ${dates.map((date) => {
          const day = dayPlan(planner, date);
          const t = dayTotals(planner, date, catalog.nutritionById);
          const candidates = leftoverCandidates(planner, date);
          const hasLeftover = day.midi.some((item) => item.leftoverOf);
          return html`
            <article class="day ${date === today ? 'day--today' : ''}" data-date="${date}">
              <header class="day__head">
                <div>
                  <p class="day__name">${capitalize(WEEKDAY.format(localDate(date)))} <span class="muted">${DAY_MONTH_SHORT.format(localDate(date))}</span></p>
                  ${date === today ? html`<p class="day__today">Aujourd'hui</p>` : ''}
                </div>
                <div class="day__gauges">
                  ${gauge({ value: t.points, max: targets.dailyPoints, label: 'Points', unit: 'pts' })}
                  ${gauge({ value: t.protein, max: targets.proteinG, label: 'Protéines', unit: 'g' })}
                </div>
              </header>
              <div class="slots">
                ${PLANNER_SLOTS.map(
                  (slot) => html`
                    <div class="slot" data-slot="${slot.id}">
                      <p class="slot__label">${slot.label}</p>
                      <ul class="slot__items">
                        ${day[slot.id].map((item) => planItem({ date, item, recipe: byId.get(item.recipeId), nutrition: catalog.nutritionById.get(item.recipeId) }))}
                      </ul>
                      <div class="slot__actions">
                        <button type="button" class="chip" data-action="plan-add" data-date="${date}" data-slot="${slot.id}">${icon('plus')} Ajouter</button>
                        ${slot.id === 'midi' && candidates.length > 0 && !hasLeftover
                          ? html`<button type="button" class="chip" data-action="plan-leftover" data-date="${date}">${icon('leftover')} Restes d'hier soir</button>`
                          : ''}
                      </div>
                    </div>
                  `,
                )}
              </div>
            </article>
          `;
        })}
      </div>

      <section class="tile shopping" id="shopping" aria-labelledby="shopping-title">
        <div class="tile__head">
          <h3 class="tile__title" id="shopping-title">${icon('cart')} Liste de courses</h3>
          <p class="muted small">${weekLabel(dates)}</p>
        </div>
        ${list.groups.length === 0
          ? html`<p class="muted">Ajoute des recettes à la semaine pour remplir la liste.</p>`
          : list.groups.map(
              (group) => html`
                <h4 class="shopping__aisle">${group.label}</h4>
                <ul class="shopping__list">
                  ${group.items.map(
                    (item) => html`
                      <li class="${checked.has(item.id) ? 'is-checked' : ''}">
                        <label class="check">
                          <input type="checkbox" data-shop="${item.id}" data-week="${weekKey}" ${checked.has(item.id) ? 'checked' : ''}>
                          <span class="check__box" aria-hidden="true"></span>
                          <span class="check__name">${item.name}</span>
                          <span class="check__qty">${shoppingQuantity(item)}</span>
                        </label>
                      </li>
                    `,
                  )}
                </ul>
              `,
            )}
        ${list.pantry.length ? html`<p class="muted small shopping__pantry">Placard : ${list.pantry.map((i) => i.name.toLocaleLowerCase('fr')).join(', ')}.</p>` : ''}
      </section>
    `,
  );
}

/**
 * Sélecteur de recette pour un créneau (contenu d'un <dialog>).
 */
export function renderPicker(dialog, { date, slot, query, all, catalog, planner }) {
  const slotDef = PLANNER_SLOTS.find((s) => s.id === slot);
  const q = query.trim().toLocaleLowerCase('fr');
  const recipes = catalog.recipes.filter((recipe) => {
    if (!all && !slotDef.categories.includes(recipe.category)) return false;
    if (q && !recipe.title.toLocaleLowerCase('fr').includes(q)) return false;
    return true;
  });
  const candidates = slot === 'midi' ? leftoverCandidates(planner, date) : [];
  const byId = new Map(catalog.recipes.map((r) => [r.id, r]));

  render(
    dialog,
    html`
      <form method="dialog" class="sheet__head">
        <div>
          <p class="eyebrow">${slotDef.label} · ${capitalize(WEEKDAY.format(localDate(date)))} ${DAY_MONTH_SHORT.format(localDate(date))}</p>
          <h3 class="tile__title">Ajouter une recette</h3>
        </div>
        <button type="submit" class="icon-btn" aria-label="Fermer">${icon('close')}</button>
      </form>
      <label class="search">
        <span class="visually-hidden">Rechercher</span>
        ${icon('search')}
        <input class="input" id="picker-search" type="search" placeholder="Rechercher" value="${query}" autocomplete="off">
      </label>
      <div class="chips">
        <button type="button" class="chip" data-picker-all="false" aria-pressed="${!all}">Pour le ${slotDef.label.toLocaleLowerCase('fr')}</button>
        <button type="button" class="chip" data-picker-all="true" aria-pressed="${all}">Toutes</button>
      </div>
      <ul class="picker__list">
        ${candidates.map(
          ({ item }) => html`
            <li>
              <button type="button" class="picker__item picker__item--leftover" data-action="plan-leftover" data-date="${date}">
                <span class="picker__title">${icon('leftover')} Restes d'hier soir : ${byId.get(item.recipeId)?.title ?? item.recipeId}</span>
                <span class="picker__meta">1 portion, déjà cuisinée</span>
              </button>
            </li>
          `,
        )}
        ${recipes.length === 0 ? html`<li class="muted picker__empty">Aucune recette.</li>` : ''}
        ${recipes.map((recipe) => {
          const n = catalog.nutritionById.get(recipe.id);
          return html`
            <li>
              <button type="button" class="picker__item" data-action="plan-pick" data-date="${date}" data-slot="${slot}" data-recipe="${recipe.id}">
                <span class="picker__title">${recipe.title}</span>
                <span class="picker__meta">${RECIPE_CATEGORIES[recipe.category] ?? recipe.category} · ${fmt.int(n.perPortion.kcal)} kcal · P ${fmt.int(n.perPortion.protein)} g</span>
                <span class="badge">${fmt.dec(n.points)} <small>pts</small></span>
              </button>
            </li>
          `;
        })}
      </ul>
    `,
  );
}

/**
 * Petit formulaire « Planifier cette recette » (contenu d'un <dialog>).
 */
export function renderPlanRecipe(dialog, { recipe, today }) {
  render(
    dialog,
    html`
      <form method="dialog" class="sheet__head">
        <div>
          <p class="eyebrow">Planifier</p>
          <h3 class="tile__title">${recipe.title}</h3>
        </div>
        <button type="submit" class="icon-btn" aria-label="Fermer">${icon('close')}</button>
      </form>
      <form id="plan-recipe-form" class="form" data-recipe="${recipe.id}">
        <div class="fields fields--2">
          <div class="field">
            <label class="field__label" for="plan-date">Jour</label>
            <input class="input" id="plan-date" name="date" type="date" value="${today}" min="${addDays(today, -7)}" required>
          </div>
          <div class="field">
            <label class="field__label" for="plan-slot">Créneau</label>
            <select class="input" id="plan-slot" name="slot">
              ${PLANNER_SLOTS.map((slot) => html`<option value="${slot.id}" ${slot.categories.includes(recipe.category) ? 'selected' : ''}>${slot.label}</option>`)}
            </select>
          </div>
        </div>
        <div class="form__actions">
          <button type="submit" class="btn btn--primary">Ajouter au planning</button>
        </div>
      </form>
    `,
  );
}
