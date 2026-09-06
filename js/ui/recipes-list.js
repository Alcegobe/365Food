/**
 * Catalogue de recettes : recherche, filtres, cartes.
 */
import { RECIPE_CATEGORIES, RECIPE_FILTERS, RECIPE_TAGS } from '../config.js';
import { totalMinutes } from '../recipes.js';
import { fmt, html, render } from './dom.js';
import { icon } from './icons.js';

/** Coquille de la page (recherche, puces, filtres) ; les résultats sont rendus à part. */
export function renderRecipesView(container, { filters }) {
  const advancedOpen = filters.maxPoints !== null || filters.maxMinutes !== null || filters.tags.length > 0;
  render(
    container,
    html`
      <h2 class="headline">Recettes</h2>
      <div class="toolbar">
        <label class="search">
          <span class="visually-hidden">Rechercher un plat ou un ingrédient</span>
          ${icon('search')}
          <input class="input" id="recipe-search" type="search" placeholder="Plat ou ingrédient" value="${filters.query}" autocomplete="off">
        </label>
        <div class="chips" role="group" aria-label="Catégorie">
          <button type="button" class="chip" data-filter-category="all" aria-pressed="${filters.category === 'all'}">Toutes</button>
          ${Object.entries(RECIPE_CATEGORIES).map(
            ([id, label]) => html`<button type="button" class="chip" data-filter-category="${id}" aria-pressed="${filters.category === id}">${label}</button>`,
          )}
        </div>
        <details class="filters-more" ${advancedOpen ? 'open' : ''}>
          <summary>Plus de filtres</summary>
          <div class="filters">
            <div class="filters__row">
              <label>Points max
                <select class="input" data-filter-points>
                  <option value="">—</option>
                  ${RECIPE_FILTERS.maxPointsChoices.map((n) => html`<option value="${n}" ${filters.maxPoints === n ? 'selected' : ''}>${n}</option>`)}
                </select>
              </label>
              <label>Temps max
                <select class="input" data-filter-minutes>
                  <option value="">—</option>
                  ${RECIPE_FILTERS.maxMinutesChoices.map((n) => html`<option value="${n}" ${filters.maxMinutes === n ? 'selected' : ''}>${n} min</option>`)}
                </select>
              </label>
            </div>
            <div class="chips" role="group" aria-label="Tags">
              ${Object.entries(RECIPE_TAGS).map(
                ([id, label]) => html`<button type="button" class="chip" data-filter-tag="${id}" aria-pressed="${filters.tags.includes(id)}">${label}</button>`,
              )}
            </div>
            <div class="btn-row">
              <button type="button" class="btn" data-action="reset-filters">Réinitialiser</button>
            </div>
          </div>
        </details>
      </div>
      <div id="recipe-results" aria-live="polite"></div>
    `,
  );
}

/** Met les puces et listes en accord avec les filtres courants (sans re-rendre la recherche). */
export function syncFilterControls(container, filters) {
  container.querySelectorAll('[data-filter-category]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filterCategory === filters.category));
  });
  container.querySelectorAll('[data-filter-tag]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(filters.tags.includes(chip.dataset.filterTag)));
  });
  const points = container.querySelector('[data-filter-points]');
  if (points) points.value = filters.maxPoints === null ? '' : String(filters.maxPoints);
  const minutes = container.querySelector('[data-filter-minutes]');
  if (minutes) minutes.value = filters.maxMinutes === null ? '' : String(filters.maxMinutes);
}

function recipeCard(recipe, n) {
  return html`
    <a class="recipe-card" href="#/recettes/${encodeURIComponent(recipe.id)}">
      <span class="recipe-card__cat">${RECIPE_CATEGORIES[recipe.category] ?? recipe.category}</span>
      <span class="recipe-card__title">${recipe.title}</span>
      <span class="recipe-card__meta">${totalMinutes(recipe)} min · ${recipe.servings} ${recipe.servings > 1 ? 'portions' : 'portion'}</span>
      <span class="recipe-card__foot">
        <span class="recipe-card__macros">${fmt.int(n.perPortion.kcal)} kcal · P ${fmt.int(n.perPortion.protein)} g</span>
        <span class="badge">${fmt.dec(n.points)} <small>pts</small></span>
      </span>
    </a>
  `;
}

/** Cartes des recettes filtrées ; `grouped` les range par catégorie (vue « Toutes »). */
export function renderRecipeResults(container, { recipes, nutritionById, grouped = false }) {
  if (recipes.length === 0) {
    render(
      container,
      html`
        <div class="empty">
          <p>Aucune recette ne correspond.</p>
          <p><button type="button" class="btn" data-action="reset-filters">Réinitialiser les filtres</button></p>
        </div>
      `,
    );
    return;
  }
  const count = html`<p class="results-count">${recipes.length} ${recipes.length > 1 ? 'recettes' : 'recette'}</p>`;
  if (!grouped) {
    render(container, html`${count}<div class="cards">${recipes.map((recipe) => recipeCard(recipe, nutritionById.get(recipe.id)))}</div>`);
    return;
  }
  const groups = Object.entries(RECIPE_CATEGORIES)
    .map(([id, label]) => ({ id, label, recipes: recipes.filter((recipe) => recipe.category === id) }))
    .filter((group) => group.recipes.length > 0);
  render(
    container,
    html`
      ${count}
      ${groups.map(
        (group) => html`
          <section class="catalogue-group" aria-labelledby="group-${group.id}">
            <h3 class="catalogue-group__title" id="group-${group.id}">${group.label} <span class="catalogue-group__count">${group.recipes.length}</span></h3>
            <div class="cards">${group.recipes.map((recipe) => recipeCard(recipe, nutritionById.get(recipe.id)))}</div>
          </section>
        `,
      )}
    `,
  );
}
