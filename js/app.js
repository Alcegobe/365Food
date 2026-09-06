/**
 * Point d'entrée : état, routage (#/…), catalogue, planning, actions.
 */
import { RECIPE_SERVINGS_MAX, PLANNER_LIMITS } from './config.js';
import { parseDateParts } from './nutrition.js';
import { addDays, addItem, addLeftovers, findItem, removeItem, setPortions, toggleShopping, weekDates, weekStart } from './planner.js';
import { addWeighIn, isProfileValid, newProfile, removeWeighIn, targetsForProfile, todayISO } from './profile.js';
import { emptyFilters, filterRecipes, loadCatalog, scaleRecipe } from './recipes.js';
import { parseRoute, routeHash } from './router.js';
import { clearState, emptyState, exportFileName, exportState, importState, loadState, saveState } from './store.js';
import { renderDashboard } from './ui/dashboard.js';
import { downloadTextFile, readFileAsText, toast } from './ui/dom.js';
import { renderPicker, renderPlanRecipe, renderPlanner } from './ui/planner.js';
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
  planner: document.getElementById('view-planner'),
  profile: document.getElementById('view-profile'),
};
const importInput = document.getElementById('import-file');
const sheet = document.getElementById('sheet');
const main = document.getElementById('main');

let state = loadState(storage);
let catalog = null;
let catalogPromise = null;
let filters = emptyFilters();
const servingsById = new Map();
let plannerFocus = null;
let picker = null;
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

/** Charge le catalogue puis re-rend la route donnée si elle est toujours active. */
function whenCatalog(target, routeName, renderFn) {
  target.textContent = 'Chargement…';
  ensureCatalog()
    .then(() => {
      if (currentRoute().name === routeName) renderFn();
    })
    .catch(() => {
      target.textContent = 'Impossible de charger les recettes.';
    });
}

/* ---------- Rendu ---------- */

function renderAll() {
  const route = currentRoute();
  const routeKey = `${route.name}:${route.id ?? route.date ?? ''}`;
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
    case 'planner':
      renderPlannerPage(route.date);
      break;
    case 'profile':
      renderProfileForm(views.profile, { profile: state.profile ?? newProfile(), isFirstRun: !isProfileValid(state.profile) });
      break;
    default:
      renderDashboardPage();
  }

  if (changed) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.focus({ preventScroll: true });
  }
}

function renderDashboardPage() {
  renderDashboard(views.today, {
    profile: state.profile,
    targets: targetsForProfile(state.profile),
    planner: state.planner,
    catalog,
  });
  if (!catalog) {
    ensureCatalog()
      .then(() => {
        if (currentRoute().name === 'today') renderDashboardPage();
      })
      .catch(() => {});
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
    whenCatalog(target, 'recipes', renderResults);
    return;
  }
  renderRecipeResults(target, {
    recipes: filterRecipes(catalog.recipes, filters, catalog.nutritionById, catalog.ingredientIndex),
    nutritionById: catalog.nutritionById,
    grouped: filters.category === 'all',
  });
  syncFilterControls(views.recipes, filters);
}

function renderRecipePage(id) {
  if (!catalog) {
    whenCatalog(views.recipe, 'recipe', () => renderRecipePage(id));
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

function renderPlannerPage(routeDate) {
  if (routeDate && parseDateParts(routeDate)) plannerFocus = routeDate;
  if (!catalog) {
    whenCatalog(views.planner, 'planner', () => renderPlannerPage(routeDate));
    return;
  }
  const today = todayISO();
  renderPlanner(views.planner, {
    planner: state.planner,
    dates: weekDates(plannerFocus ?? today),
    today,
    catalog,
    targets: targetsForProfile(state.profile),
  });
}

/* ---------- Feuille modale ---------- */

function openSheet() {
  if (!sheet.open) sheet.showModal();
}

function closeSheet() {
  picker = null;
  if (sheet.open) sheet.close();
  sheet.replaceChildren();
}

function refreshPicker({ focusSearch = false } = {}) {
  if (!picker || !catalog) return;
  renderPicker(sheet, { ...picker, catalog, planner: state.planner });
  if (focusSearch) {
    const input = sheet.querySelector('#picker-search');
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }
}

function openPicker({ date, slot }) {
  picker = { date, slot, query: '', all: false };
  refreshPicker();
  openSheet();
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
  if (!window.confirm('Effacer le profil, l’historique de poids et le planning de cet appareil ?')) return;
  clearState(storage);
  state = emptyState();
  servingsById.clear();
  plannerFocus = null;
  window.location.hash = '#/';
  renderAll();
}

function onServings(delta) {
  const route = currentRoute();
  if (route.name !== 'recipe' || !catalog) return;
  const recipe = catalog.recipes.find((r) => r.id === route.id);
  if (!recipe) return;
  const current = servingsById.get(recipe.id) ?? recipe.servings;
  servingsById.set(recipe.id, Math.min(RECIPE_SERVINGS_MAX, Math.max(1, current + delta)));
  renderRecipePage(recipe.id);
}

function updatePlanner(next, message) {
  commit({ ...state, planner: next });
  renderAll();
  if (message) toast(message, 'success');
}

function onPlanPick({ date, slot, recipeId }) {
  try {
    const next = addItem(state.planner, { date, slot, recipeId });
    closeSheet();
    updatePlanner(next);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function onPlanLeftover(date) {
  const { planner, added } = addLeftovers(state.planner, date);
  if (sheet.open) closeSheet();
  if (added === 0) {
    toast('Rien à reprendre de la veille.', 'error');
    return;
  }
  updatePlanner(planner);
}

function onPlanPortions({ date, itemId, delta }) {
  const found = findItem(state.planner, { date, itemId });
  if (!found) return;
  const portions = Math.min(PLANNER_LIMITS.maxPortions, Math.max(1, found.item.portions + delta));
  if (portions === found.item.portions) return;
  updatePlanner(setPortions(state.planner, { date, itemId, portions }));
}

function onPlanRecipeSubmit(form) {
  const data = new FormData(form);
  const date = String(data.get('date') ?? '');
  const slot = String(data.get('slot') ?? '');
  try {
    const next = addItem(state.planner, { date, slot, recipeId: form.dataset.recipe });
    closeSheet();
    commit({ ...state, planner: next });
    toast('Ajouté au planning.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function goToWeek(date) {
  window.location.hash = routeHash(date ? { name: 'planner', date } : { name: 'planner' });
}

let printStyle = null;

function printView(kind) {
  printStyle?.remove();
  printStyle = document.createElement('style');
  printStyle.textContent = kind === 'a5' ? '@page { size: A4 landscape; margin: 10mm; }' : '@page { size: A4 portrait; margin: 14mm; }';
  document.head.append(printStyle);
  document.body.dataset.print = kind;
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
  if (event.target === sheet) {
    closeSheet();
    return;
  }

  const chip = event.target.closest('[data-filter-category], [data-filter-tag], [data-picker-all]');
  if (chip) {
    if (chip.dataset.pickerAll !== undefined && picker) {
      picker.all = chip.dataset.pickerAll === 'true';
      refreshPicker();
      return;
    }
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
  const { date, slot, item: itemId } = trigger.dataset;
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
      onDeleteWeighIn(date);
      break;
    case 'reset-filters':
      filters = emptyFilters();
      renderRecipesPage();
      break;
    case 'servings':
      onServings(Number(trigger.dataset.delta));
      break;
    case 'print':
      printView(trigger.dataset.format);
      break;
    case 'print-week':
      printView('week');
      break;
    case 'week-prev':
      goToWeek(addDays(weekStart(plannerFocus ?? todayISO()), -7));
      break;
    case 'week-next':
      goToWeek(addDays(weekStart(plannerFocus ?? todayISO()), 7));
      break;
    case 'week-today':
      plannerFocus = null;
      goToWeek(null);
      renderAll();
      break;
    case 'plan-add':
      openPicker({ date, slot });
      break;
    case 'plan-pick':
      onPlanPick({ date, slot, recipeId: trigger.dataset.recipe });
      break;
    case 'plan-leftover':
      onPlanLeftover(date);
      break;
    case 'plan-remove':
      updatePlanner(removeItem(state.planner, { date, itemId }));
      break;
    case 'plan-portions':
      onPlanPortions({ date, itemId, delta: Number(trigger.dataset.delta) });
      break;
    case 'plan-recipe': {
      const recipe = catalog?.recipes.find((r) => r.id === trigger.dataset.recipe);
      if (!recipe) return;
      renderPlanRecipe(sheet, { recipe, today: todayISO() });
      openSheet();
      break;
    }
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'recipe-search') {
    filters.query = event.target.value;
    renderResults();
  } else if (event.target.id === 'picker-search' && picker) {
    picker.query = event.target.value;
    refreshPicker({ focusSearch: true });
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-filter-points]')) {
    filters.maxPoints = event.target.value === '' ? null : Number(event.target.value);
    renderResults();
  } else if (event.target.matches('[data-filter-minutes]')) {
    filters.maxMinutes = event.target.value === '' ? null : Number(event.target.value);
    renderResults();
  } else if (event.target.matches('[data-shop]')) {
    commit({ ...state, planner: toggleShopping(state.planner, event.target.dataset.week, event.target.dataset.shop) });
    event.target.closest('li')?.classList.toggle('is-checked', event.target.checked);
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'profile-form') {
    event.preventDefault();
    onSaveProfile(event.target);
  } else if (event.target.id === 'weigh-in-form' || event.target.id === 'weigh-in-prompt') {
    event.preventDefault();
    onAddWeighIn(event.target);
  } else if (event.target.id === 'plan-recipe-form') {
    event.preventDefault();
    onPlanRecipeSubmit(event.target);
  }
});

sheet.addEventListener('close', () => {
  picker = null;
  sheet.replaceChildren();
});

importInput.addEventListener('change', () => onImportFile(importInput.files?.[0]));
window.addEventListener('hashchange', renderAll);

renderAll();
