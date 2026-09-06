/**
 * Formulaire de recette perso (brief §2.4, V4) : rendu, lignes d'ingrédients dynamiques
 * (résolues par nom dans la base), macros à la main, lecture des valeurs brutes, erreurs,
 * aperçu des macros et des points en direct.
 */
import { CUSTOM_RECIPE_LIMITS, RECIPE_CATEGORIES, RECIPE_TAGS } from '../config.js';
import { buildRecipe, matchIngredient } from '../custom-recipes.js';
import { recipeNutrition } from '../recipes.js';
import { fmt, html, render } from './dom.js';
import { icon } from './icons.js';

const LIMITS = CUSTOM_RECIPE_LIMITS;
const MANUAL_FIELDS = [
  { key: 'kcal', label: 'Énergie', unit: 'kcal', max: LIMITS.manual.kcalMax },
  { key: 'protein', label: 'Protéines', unit: 'g', max: LIMITS.manual.gramsMax },
  { key: 'fat', label: 'Lipides', unit: 'g', max: LIMITS.manual.gramsMax },
  { key: 'carbs', label: 'Glucides', unit: 'g', max: LIMITS.manual.gramsMax },
  { key: 'fiber', label: 'Fibres', unit: 'g', max: LIMITS.manual.gramsMax },
];
/** Élément à focaliser pour chaque champ en erreur. */
const FOCUS_TARGET = {
  title: '#r-title',
  category: '#r-category',
  tags: '[name="tags"]',
  servings: '#r-servings',
  prepMin: '#r-prepMin',
  cookMin: '#r-cookMin',
  ingredients: '[name="ing-name"]',
  nutritionOverride: '#r-m-kcal',
  steps: '#r-steps',
};

let rowCounter = 0;

function recipeField({ name, label, control, hint = '' }) {
  return html`
    <div class="field" data-field="${name}">
      <label class="field__label" for="r-${name}">${label}</label>
      ${control}
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
      <p class="field__error" id="r-${name}-error" aria-live="polite"></p>
    </div>
  `;
}

function recipeNumberField({ name, value, unit, min, max, step = 1 }) {
  return html`
    <div class="with-unit">
      <input class="input" id="r-${name}" name="${name}" type="number" step="${step}" min="${min}" max="${max}" value="${value}" inputmode="numeric" aria-describedby="r-${name}-error">
      <span class="with-unit__unit" aria-hidden="true">${unit}</span>
    </div>
  `;
}

function recipeTextArea({ name, value, rows }) {
  return html`<textarea class="input" id="r-${name}" name="${name}" rows="${rows}" maxlength="${LIMITS.textMaxLength * 4}" aria-describedby="r-${name}-error">${value}</textarea>`;
}

/** Une ligne d'ingrédient : nom (liste de la base), quantité, unité, libellé et ref d'origine cachés. */
function ingredientRow({ name = '', qty = '', unit = 'g', label = '', ref = '' } = {}) {
  rowCounter += 1;
  const id = `ing-${rowCounter}`;
  return html`
    <li class="ing-row" data-row>
      <div class="ing-row__name">
        <label class="visually-hidden" for="${id}-name">Ingrédient</label>
        <input class="input" id="${id}-name" name="ing-name" list="ingredient-names" value="${name}" placeholder="Ingrédient" autocomplete="off" autocapitalize="off" spellcheck="false">
        <p class="ing-row__hint" data-ing-hint></p>
      </div>
      <div class="ing-row__qty">
        <label class="visually-hidden" for="${id}-qty">Quantité</label>
        <input class="input" id="${id}-qty" name="ing-qty" type="number" step="any" min="0" max="${LIMITS.qtyMax}" inputmode="decimal" value="${qty}" placeholder="Qté">
      </div>
      <div class="ing-row__unit">
        <label class="visually-hidden" for="${id}-unit">Unité</label>
        <select class="input" id="${id}-unit" name="ing-unit">
          <option value="g" ${unit === 'g' ? 'selected' : ''}>g</option>
          <option value="ml" ${unit === 'ml' ? 'selected' : ''}>ml</option>
          <option value="pce" ${unit === 'pce' ? 'selected' : ''}>pièce</option>
        </select>
      </div>
      <input type="hidden" name="ing-label" value="${label}">
      <input type="hidden" name="ing-ref" value="${ref}">
      <button type="button" class="icon-btn icon-btn--soft ing-row__remove" data-row-remove aria-label="Retirer cet ingrédient">${icon('close')}</button>
    </li>
  `;
}

/**
 * `values` : valeurs de formulaire (recipeFormValues) ; `mode` : 'new' | 'edit' ; `recipeId` en édition ;
 * `baseTitle` : titre de la recette dupliquée ; `ingredients` : base triée (liste de suggestions) ;
 * `ingredientIndex` : pour l'aperçu.
 */
export function renderRecipeForm(container, { values, mode, recipeId = null, baseTitle = '', ingredients, ingredientIndex }) {
  const isEdit = mode === 'edit';
  const rows = values.ingredients.length ? values.ingredients : [{}, {}, {}];
  const manualOpen = Object.values(values.manual).some((v) => v !== '');
  const backHref = isEdit ? `#/recettes/${encodeURIComponent(recipeId)}` : '#/recettes';

  render(
    container,
    html`
      <div class="fiche__top">
        <a class="btn" href="${backHref}">${icon('arrowLeft')} ${isEdit ? 'Fiche' : 'Recettes'}</a>
      </div>
      <h2 class="headline">${isEdit ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
      ${baseTitle ? html`<p class="subline">D'après « ${baseTitle} ».</p>` : ''}

      <form id="recipe-form" class="form" novalidate data-mode="${mode}" data-recipe="${recipeId ?? ''}">
        <div class="form-summary" id="recipe-form-summary" role="alert" aria-live="assertive"></div>

        <fieldset>
          <legend>La recette</legend>
          <div class="fields">
            ${recipeField({
              name: 'title',
              label: 'Titre',
              control: html`<input class="input" id="r-title" name="title" type="text" value="${values.title}" maxlength="${LIMITS.titleMaxLength}" autocomplete="off" aria-describedby="r-title-error">`,
            })}
          </div>
          <div class="fields fields--2">
            ${recipeField({
              name: 'category',
              label: 'Catégorie',
              control: html`
                <select class="input" id="r-category" name="category" aria-describedby="r-category-error">
                  <option value="" ${values.category ? '' : 'selected'}>—</option>
                  ${Object.entries(RECIPE_CATEGORIES).map(([id, label]) => html`<option value="${id}" ${values.category === id ? 'selected' : ''}>${label}</option>`)}
                </select>
              `,
            })}
            ${recipeField({ name: 'servings', label: 'Portions', control: recipeNumberField({ name: 'servings', value: values.servings, unit: 'portions', min: LIMITS.servings.min, max: LIMITS.servings.max }) })}
          </div>
          <div class="fields fields--2">
            ${recipeField({ name: 'prepMin', label: 'Préparation', control: recipeNumberField({ name: 'prepMin', value: values.prepMin, unit: 'min', min: LIMITS.minutes.min, max: LIMITS.minutes.max }) })}
            ${recipeField({ name: 'cookMin', label: 'Cuisson', control: recipeNumberField({ name: 'cookMin', value: values.cookMin, unit: 'min', min: LIMITS.minutes.min, max: LIMITS.minutes.max }) })}
          </div>
          <div class="fields">
            ${recipeField({
              name: 'portionNote',
              label: 'Précision sur la portion',
              control: html`<input class="input" id="r-portionNote" name="portionNote" type="text" value="${values.portionNote}" maxlength="120" placeholder="Facultatif, ex. 1 portion ≈ 3 c. à s.">`,
            })}
            <div class="field" data-field="tags">
              <span class="field__label" id="r-tags-label">Tags</span>
              <div class="chips" role="group" aria-labelledby="r-tags-label">
                ${Object.entries(RECIPE_TAGS).map(
                  ([id, label]) => html`<label class="chip chip--check"><input type="checkbox" name="tags" value="${id}" ${values.tags.includes(id) ? 'checked' : ''}><span>${label}</span></label>`,
                )}
              </div>
              <p class="field__error" id="r-tags-error" aria-live="polite"></p>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Ingrédients</legend>
          <ul class="ing-list" id="ing-list">${rows.map((row) => ingredientRow(row))}</ul>
          <div class="btn-row">
            <button type="button" class="btn" data-row-add>${icon('plus')} Ajouter un ingrédient</button>
          </div>
          <p class="field__error" id="r-ingredients-error" aria-live="polite"></p>
          <details class="manual" ${manualOpen ? 'open' : ''}>
            <summary>Macros saisies à la main</summary>
            <p class="field__hint">Par portion. Remplace le calcul depuis les ingrédients.</p>
            <div class="fields fields--3">
              ${MANUAL_FIELDS.map(
                ({ key, label, unit, max }) => html`
                  <div class="field">
                    <label class="field__label" for="r-m-${key}">${label}</label>
                    <div class="with-unit">
                      <input class="input" id="r-m-${key}" name="m-${key}" type="number" step="any" min="0" max="${max}" inputmode="decimal" value="${values.manual[key]}">
                      <span class="with-unit__unit" aria-hidden="true">${unit}</span>
                    </div>
                  </div>
                `,
              )}
            </div>
            <p class="field__error" id="r-nutritionOverride-error" aria-live="polite"></p>
          </details>
        </fieldset>

        <fieldset>
          <legend>Préparation</legend>
          <div class="fields">
            ${recipeField({ name: 'steps', label: 'Étapes', hint: 'Une étape par ligne.', control: recipeTextArea({ name: 'steps', value: values.steps, rows: 5 }) })}
            ${recipeField({ name: 'whyLight', label: "Pourquoi c'est léger", control: recipeTextArea({ name: 'whyLight', value: values.whyLight, rows: 2 }) })}
            ${recipeField({ name: 'leftoverTip', label: 'Le lendemain', control: recipeTextArea({ name: 'leftoverTip', value: values.leftoverTip, rows: 2 }) })}
            ${recipeField({ name: 'variants', label: 'Variantes', hint: 'Une variante par ligne.', control: recipeTextArea({ name: 'variants', value: values.variants, rows: 3 }) })}
          </div>
        </fieldset>

        <p class="preview preview--empty" id="recipe-preview" aria-live="polite"></p>

        <div class="form__actions">
          <button type="submit" class="btn btn--primary">${isEdit ? 'Enregistrer' : 'Ajouter à mes recettes'}</button>
          <a class="btn" href="${backHref}">Annuler</a>
          ${isEdit ? html`<button type="button" class="btn btn--danger" data-action="recipe-delete" data-recipe="${recipeId}">${icon('trash')} Supprimer</button>` : ''}
        </div>
      </form>
      <datalist id="ingredient-names">${ingredients.map((item) => html`<option value="${item.name}"></option>`)}</datalist>
    `,
  );

  const form = container.querySelector('#recipe-form');
  attachRecipeFormBehaviour(form, ingredientIndex);
  updateRecipePreview(form, ingredientIndex);
  return form;
}

/** Valeurs brutes du formulaire (chaînes), au format attendu par buildRecipe. */
export function readRecipeForm(form) {
  const data = new FormData(form);
  const get = (name) => String(data.get(name) ?? '');
  const names = data.getAll('ing-name');
  const qtys = data.getAll('ing-qty');
  const units = data.getAll('ing-unit');
  const labels = data.getAll('ing-label');
  const refs = data.getAll('ing-ref');
  return {
    title: get('title'),
    category: get('category'),
    tags: data.getAll('tags').map(String),
    servings: get('servings'),
    prepMin: get('prepMin'),
    cookMin: get('cookMin'),
    portionNote: get('portionNote'),
    ingredients: names.map((name, i) => ({
      name: String(name),
      qty: String(qtys[i] ?? ''),
      unit: String(units[i] ?? 'g'),
      label: String(labels[i] ?? ''),
      ref: String(refs[i] ?? ''),
    })),
    steps: get('steps'),
    whyLight: get('whyLight'),
    leftoverTip: get('leftoverTip'),
    variants: get('variants'),
    manual: Object.fromEntries(MANUAL_FIELDS.map(({ key }) => [key, get(`m-${key}`)])),
  };
}

/** Affiche les erreurs sous les champs et dans le résumé (liste vide = tout effacer). */
export function showRecipeFormErrors(form, errors) {
  form.querySelectorAll('.field__error').forEach((el) => {
    el.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const summary = form.querySelector('#recipe-form-summary');
  if (errors.length === 0) {
    summary.textContent = '';
    return;
  }
  const shown = new Set();
  for (const { field, message } of errors) {
    const target = form.querySelector(`#r-${field}-error`);
    if (target && !shown.has(field)) {
      target.textContent = message;
      shown.add(field);
    }
    const input = form.querySelector(FOCUS_TARGET[field] ?? `[name="${field}"]`);
    if (input && field !== 'ingredients' && field !== 'tags') input.setAttribute('aria-invalid', 'true');
  }
  if (shown.has('nutritionOverride')) form.querySelector('.manual')?.setAttribute('open', '');
  render(
    summary,
    html`
      <strong>${errors.length === 1 ? 'Un point à corriger :' : `${errors.length} points à corriger :`}</strong>
      <ul>${errors.map((e) => html`<li>${e.message}</li>`)}</ul>
    `,
  );
  const first = form.querySelector(FOCUS_TARGET[errors[0].field] ?? '#r-title');
  first?.focus();
}

/** Aperçu des macros et des points par portion, plus l'état de chaque ligne d'ingrédient. */
export function updateRecipePreview(form, ingredientIndex) {
  form.querySelectorAll('[data-row]').forEach((row) => {
    const nameInput = row.querySelector('[name="ing-name"]');
    const hint = row.querySelector('[data-ing-hint]');
    const pieceOption = row.querySelector('[name="ing-unit"] option[value="pce"]');
    const text = nameInput.value.trim();
    const item = text ? matchIngredient(text, ingredientIndex) : null;
    if (!text) hint.textContent = '';
    else if (item) hint.textContent = item.name === text ? '' : item.name;
    else hint.textContent = 'Inconnu : choisis un ingrédient de la liste.';
    row.classList.toggle('is-unknown', Boolean(text) && !item);
    pieceOption.textContent = item?.piece?.name ?? 'pièce';
    pieceOption.disabled = Boolean(item) && !item.piece?.grams;
  });

  const preview = form.querySelector('#recipe-preview');
  if (!preview) return;
  const { recipe } = buildRecipe(readRecipeForm(form), ingredientIndex);
  const lines = recipe.ingredients.filter((line) => Number.isFinite(line.qty) && line.qty > 0 && !(line.unit === 'pce' && !ingredientIndex.get(line.ref)?.piece?.grams));
  const draft = { ...recipe, ingredients: lines };
  let nutrition = null;
  if (Number.isInteger(draft.servings) && draft.servings >= 1 && (draft.nutritionOverride || lines.length > 0)) {
    try {
      nutrition = recipeNutrition(draft, ingredientIndex);
    } catch {
      nutrition = null;
    }
  }
  const p = nutrition?.perPortion;
  if (!p || ![p.kcal, p.protein, p.fat, p.carbs].every(Number.isFinite)) {
    preview.className = 'preview preview--empty';
    preview.textContent = 'Les macros par portion s’affichent dès qu’un ingrédient est pesé.';
    return;
  }
  preview.className = 'preview';
  preview.textContent = `Par portion : ${fmt.kcal(p.kcal)} · P ${fmt.g(p.protein)} · L ${fmt.g(p.fat)} · G ${fmt.g(p.carbs)} · fibres ${fmt.dec(p.fiber)} g · ${fmt.points(nutrition.points)}`;
}

function attachRecipeFormBehaviour(form, ingredientIndex) {
  const list = form.querySelector('#ing-list');
  const addRow = () => {
    list.insertAdjacentHTML('beforeend', String(ingredientRow()));
    const input = list.lastElementChild.querySelector('[name="ing-name"]');
    input.focus();
    return input;
  };

  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-row-add]')) {
      addRow();
      return;
    }
    const remove = event.target.closest('[data-row-remove]');
    if (!remove) return;
    remove.closest('[data-row]').remove();
    if (!list.children.length) addRow();
    updateRecipePreview(form, ingredientIndex);
  });

  // Entrée dans une ligne d'ingrédient : on passe au champ suivant au lieu d'envoyer le formulaire.
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.matches('[name="ing-name"], [name="ing-qty"]')) return;
    event.preventDefault();
    const row = event.target.closest('[data-row]');
    if (event.target.name === 'ing-name') {
      row.querySelector('[name="ing-qty"]').focus();
      return;
    }
    const next = row.nextElementSibling?.querySelector('[name="ing-name"]');
    if (next) next.focus();
    else addRow();
  });

  // Les zones de texte grandissent avec leur contenu (étapes longues).
  const grow = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };
  form.querySelectorAll('textarea').forEach(grow);
  form.addEventListener('input', (event) => {
    if (event.target.matches('textarea')) grow(event.target);
  });

  const refresh = () => updateRecipePreview(form, ingredientIndex);
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
}
