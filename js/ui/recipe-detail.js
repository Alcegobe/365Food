/**
 * Fiche recette : macros par portion, ingrédients ajustables, étapes, notes, impression.
 */
import { RECIPE_CATEGORIES, RECIPE_SERVINGS_MAX, RECIPE_TAGS } from '../config.js';
import { formatQuantity, ingredientLabel } from '../recipes.js';
import { fmt, html, render } from './dom.js';
import { icon } from './icons.js';

function macroTile(label, value, unit, extraClass = '') {
  return html`
    <article class="tile ${extraClass}">
      <p class="tile__label">${label}</p>
      <p class="tile__value">${value} <small>${unit}</small></p>
    </article>
  `;
}

/** Le titre de la tuile dit déjà « Le lendemain » : on retire ce préfixe de la note. */
function leftoverText(tip) {
  const text = String(tip).replace(/^le lendemain(?: midi)?\s*:\s*/i, '');
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}

/** `recipe` est déjà ajustée au nombre de portions demandé (scaleRecipe). */
export function renderRecipeView(container, { recipe, nutrition, ingredientIndex }) {
  const p = nutrition.perPortion;
  const tags = (recipe.tags ?? []).map((tag) => RECIPE_TAGS[tag] ?? tag);
  const timeParts = [];
  if (recipe.prepMin) timeParts.push(`${recipe.prepMin} min de préparation`);
  if (recipe.cookMin) timeParts.push(`${recipe.cookMin} min de cuisson`);
  if (recipe.portionNote) timeParts.push(recipe.portionNote);

  render(
    container,
    html`
      <article class="fiche" data-recipe="${recipe.id}">
        <div class="fiche__top">
          <a class="btn" href="#/recettes">${icon('arrowLeft')} Recettes</a>
          <div class="btn-row">
            <button type="button" class="btn btn--primary" data-action="plan-recipe" data-recipe="${recipe.id}">${icon('planner')} Planifier</button>
            <button type="button" class="btn" data-action="print" data-format="a4">${icon('print')} A4</button>
            <button type="button" class="btn" data-action="print" data-format="a5">${icon('print')} A5</button>
          </div>
        </div>

        <header class="fiche__head">
        <p class="eyebrow">${[RECIPE_CATEGORIES[recipe.category] ?? recipe.category, ...tags].join(' · ')}</p>
        <h2 class="headline">${recipe.title}</h2>
        <p class="subline">${timeParts.join(' · ')}</p>

        <div class="tiles tiles--macros">
          ${macroTile('Points', fmt.dec(nutrition.points), 'par portion', 'tile--dark')}
          ${macroTile('Énergie', fmt.int(p.kcal), 'kcal')}
          ${macroTile('Protéines', fmt.int(p.protein), 'g')}
          ${macroTile('Lipides', fmt.int(p.fat), 'g')}
          ${macroTile('Glucides', fmt.int(p.carbs), 'g')}
          ${macroTile('Fibres', fmt.dec(p.fiber), 'g')}
        </div>
        </header>

        <div class="grid fiche__body">
          <div class="grid__col">
            <section class="tile tile--white" aria-labelledby="ingredients-title">
              <div class="tile__head">
                <h3 class="tile__title" id="ingredients-title">Ingrédients</h3>
                <div class="stepper" role="group" aria-label="Nombre de portions">
                  <button type="button" data-action="servings" data-delta="-1" aria-label="Une portion de moins" ${recipe.servings <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
                  <output aria-live="polite">${recipe.servings} ${recipe.servings > 1 ? 'portions' : 'portion'}</output>
                  <button type="button" data-action="servings" data-delta="1" aria-label="Une portion de plus" ${recipe.servings >= RECIPE_SERVINGS_MAX ? 'disabled' : ''}>${icon('plus')}</button>
                </div>
              </div>
              <ul class="ingredients">
                ${recipe.ingredients.map((line) => {
                  const item = ingredientIndex.get(line.ref);
                  return html`<li><span>${ingredientLabel(line, item)}</span><span class="qty">${formatQuantity(line, item, fmt.dec)}</span></li>`;
                })}
              </ul>
            </section>

            <section class="tile" aria-labelledby="steps-title">
              <h3 class="tile__title" id="steps-title">Préparation</h3>
              <ol class="steps">
                ${recipe.steps.map((step) => html`<li>${step}</li>`)}
              </ol>
            </section>
          </div>

          <div class="grid__col">
            ${recipe.whyLight
              ? html`
                  <section class="tile" aria-labelledby="why-title">
                    <h3 class="tile__title" id="why-title">Pourquoi c'est léger</h3>
                    <p>${recipe.whyLight}</p>
                  </section>
                `
              : ''}
            ${recipe.leftoverTip
              ? html`
                  <section class="tile" aria-labelledby="leftover-title">
                    <h3 class="tile__title" id="leftover-title">Le lendemain</h3>
                    <p>${leftoverText(recipe.leftoverTip)}</p>
                  </section>
                `
              : ''}
            ${recipe.variants?.length
              ? html`
                  <section class="tile" aria-labelledby="variants-title">
                    <h3 class="tile__title" id="variants-title">Variantes</h3>
                    <ul class="plain-list">${recipe.variants.map((v) => html`<li>${v}</li>`)}</ul>
                  </section>
                `
              : ''}
          </div>
        </div>
      </article>
    `,
  );
}

/** Fiche introuvable. */
export function renderRecipeMissing(container, id) {
  render(
    container,
    html`
      <div class="empty">
        <p>Recette introuvable (${id}).</p>
        <p><a class="btn" href="#/recettes">${icon('arrowLeft')} Recettes</a></p>
      </div>
    `,
  );
}
