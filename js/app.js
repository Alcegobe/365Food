/**
 * Point d'entrée : état, routage (#/…), catalogue, actions.
 */
import { addWeighIn, isProfileValid, newProfile, removeWeighIn, targetsForProfile } from './profile.js';
import { RECIPE_SERVINGS_MAX } from './config.js';
import { emptyFilters, filterRecipes, loadCatalog, scaleRecipe } from './recipes.js';
import { parseRoute } from './router.js';
import { clearState, emptyState, exportFileName, exportState, importState, loadState, saveState } from './store.js';
import { renderDashboard } from './ui/dashboard.js';
import { downloadTextFile, readFileAsText, toast } from './ui/dom.js';
import { readProfileForm, renderProfileForm, showFormErrors } from './ui/profile-form.js';
import { renderRecipeMissing, renderRecipeView } from './ui/recipe-detail.js';
import { renderRecipeResults, renderRecipesView, syncFilterControls } from './ui/recipes-list.js';

/** localStorage, ou une doublure en mémoire si le navigateur le refuse. */
function resolveStorage() {
  try {
    const probe = '365food.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
      volatile: true,
    };
  }
}

const storage = resolveStorage();
const views = {
  today: document.getElementById('view-dashboard'),
  recipes: document.getElementById('view-recipes'),
  recipe: document.getElementById('view-recipe'),
  profile: document.getElementById('view-profile'),
};
const importInput = document.getElementById('import-file');
const main = document.getElementById('main');

let state = loadState(storage);
let catalog = null;
let catalogPromise = null;
let filters = emptyFilters();
const servingsById = new Map();
let lastRouteKey = '';

/* ---------- État ---------- */

function commit(nextState) {
  state = saveState(nextState, storage);
  if (storage.volatile) toast('Stockage local indisponible : les données seront perdues à la fermeture.', 'error');
}

function currentRoute() {
  if (!isProfileValid(state.profile)) return { name: 'profile', forced: true };
  return parseRoute(window.location.hash);
}

function ensureCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!catalogPromise) {
    catalogPromise = loadCatalog()
      .then((loaded) => {
        catalog = loaded;
        return loaded;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

/* ---------- Rendu ---------- */

function renderAll() {
  const route = currentRoute();
  const routeKey = `${route.name}:${route.id ?? ''}`;
  const changed = routeKey !== lastRouteKey;
  lastRouteKey = routeKey;

  for (const [name, el] of Object.entries(views)) {
    el.hidden = name !== route.name;
    if (name !== route.name) el.replaceChildren();
  }
  document.body.dataset.view = route.name;
  document.querySelectorAll('.tabbar a[data-route]').forEach((link) => {
    const active = link.dataset.route === route.name || (link.dataset.route === 'recipes' && route.name === 'recipe');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  switch (route.name) {
    case 'recipes':
      renderRecipesPage();
      break;
    case 'recipe':
      renderRecipePage(route.id);
      break;
    case 'profile':
      renderProfileForm(views.profile, { profile: state.profile ?? newProfile(), isFirstRun: !isProfileValid(state.profile) });
      break;
    default:
      renderDashboard(views.today, { profile: state.profile, targets: targetsForProfile(state.profile) });
  }

  if (changed) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.focus({ preventScroll: true });
  }
}

function renderRecipesPage() {
  renderRecipesView(views.recipes, { filters });
  renderResults();
}

function renderResults() {
  const target = views.recipes.querySelector('#recipe-results');
  if (!target) return;
  if (!catalog) {
    target.textContent = 'Chargement…';
    ensureCatalog()
      .then(() => {
        if (currentRoute().name === 'recipes') renderResults();
      })
      .catch(() => {
        target.textContent = 'Impossible de charger les recettes.';
      });
    return;
  }
  renderRecipeResults(target, {
    recipes: filterRecipes(catalog.recipes, filters, catalog.nutritionById, catalog.ingredientIndex),
    nutritionById: catalog.nutritionById,
  });
  syncFilterControls(views.recipes, filters);
}

function renderRecipePage(id) {
  if (!catalog) {
    views.recipe.textContent = 'Chargement…';
    ensureCatalog()
      .then(() => {
        const route = currentRoute();
        if (route.name === 'recipe' && route.id === id) renderRecipePage(id);
      })
      .catch(() => {
        views.recipe.textContent = 'Impossible de charger les recettes.';
      });
    return;
  }
  const recipe = catalog.recipes.find((r) => r.id === id);
  if (!recipe) {
    renderRecipeMissing(views.recipe, id);
    return;
  }
  const servings = servingsById.get(id) ?? recipe.servings;
  renderRecipeView(views.recipe, {
    recipe: scaleRecipe(recipe, servings),
    nutrition: catalog.nutritionById.get(id),
    ingredientIndex: catalog.ingredientIndex,
  });
}

/* ---------- Actions ---------- */

function onSaveProfile(form) {
  const { profile, errors } = readProfileForm(form, state.profile ?? newProfile());
  showFormErrors(form, errors);
  if (errors.length > 0) return;
  commit({ ...state, profile });
  toast('Profil enregistré.', 'success');
  if (parseRoute(window.location.hash).name === 'profile') window.location.hash = '#/';
  else renderAll();
}

function onAddWeighIn(form) {
  const data = new FormData(form);
  const kg = Number(String(data.get('kg') ?? '').replace(',', '.'));
  const date = String(data.get('date') ?? '');
  if (!data.get('kg') || Number.isNaN(kg)) {
    toast('Indique un poids en kg.', 'error');
    form.elements.kg.focus();
    return;
  }
  try {
    commit({ ...state, profile: addWeighIn(state.profile, { date, kg }) });
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  renderAll();
  toast('Pesée enregistrée.', 'success');
}

function onDeleteWeighIn(date) {
  if ((state.profile?.weights?.length ?? 0) <= 1) {
    toast('Garde au moins une pesée.', 'error');
    return;
  }
  commit({ ...state, profile: removeWeighIn(state.profile, date) });
  renderAll();
}

function onExport() {
  try {
    downloadTextFile(exportFileName(), exportState(state));
  } catch (err) {
    toast(`Export impossible : ${err.message}`, 'error');
  }
}

async function onImportFile(file) {
  if (!file) return;
  let imported;
  try {
    imported = importState(await readFileAsText(file));
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  if (state.profile !== null && !window.confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
  commit(imported);
  window.location.hash = '#/';
  renderAll();
  toast('Sauvegarde importée.', 'success');
}

function onReset() {
  if (!window.confirm('Effacer le profil et l’historique de poids de cet appareil ?')) return;
  clearState(storage);
  state = emptyState();
  servingsById.clear();
  window.location.hash = '#/';
  renderAll();
}

function onServings(delta) {
  const route = currentRoute();
  if (route.name !== 'recipe' || !catalog) return;
  const recipe = catalog.recipes.find((r) => r.id === route.id);
  if (!recipe) return;
  const current = servingsById.get(recipe.id) ?? recipe.servings;
  const next = Math.min(RECIPE_SERVINGS_MAX, Math.max(1, current + delta));
  servingsById.set(recipe.id, next);
  renderRecipePage(recipe.id);
}

let printStyle = null;

function printRecipe(format) {
  printStyle?.remove();
  printStyle = document.createElement('style');
  printStyle.textContent = format === 'a5' ? '@page { size: A4 landscape; margin: 10mm; }' : '@page { size: A4 portrait; margin: 14mm; }';
  document.head.append(printStyle);
  document.body.dataset.print = format;
  const cleanup = () => {
    printStyle?.remove();
    printStyle = null;
    delete document.body.dataset.print;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/* ---------- Câblage ---------- */

document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter-category], [data-filter-tag]');
  if (chip) {
    if (chip.dataset.filterCategory) filters.category = chip.dataset.filterCategory;
    if (chip.dataset.filterTag) {
      const tag = chip.dataset.filterTag;
      filters.tags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    }
    renderResults();
    return;
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  switch (trigger.dataset.action) {
    case 'export':
      onExport();
      break;
    case 'import':
      importInput.value = '';
      importInput.click();
      break;
    case 'reset':
      onReset();
      break;
    case 'delete-weigh-in':
      onDeleteWeighIn(trigger.dataset.date);
      break;
    case 'reset-filters':
      filters = emptyFilters();
      renderRecipesPage();
      break;
    case 'servings':
      onServings(Number(trigger.dataset.delta));
      break;
    case 'print':
      printRecipe(trigger.dataset.format);
      break;
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'recipe-search') {
    filters.query = event.target.value;
    renderResults();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-filter-points]')) {
    filters.maxPoints = event.target.value === '' ? null : Number(event.target.value);
    renderResults();
  } else if (event.target.matches('[data-filter-minutes]')) {
    filters.maxMinutes = event.target.value === '' ? null : Number(event.target.value);
    renderResults();
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'profile-form') {
    event.preventDefault();
    onSaveProfile(event.target);
  } else if (event.target.id === 'weigh-in-form') {
    event.preventDefault();
    onAddWeighIn(event.target);
  }
});

importInput.addEventListener('change', () => onImportFile(importInput.files?.[0]));
window.addEventListener('hashchange', renderAll);

renderAll();
