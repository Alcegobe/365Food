/**
 * Point d'entrée : état, navigation entre le tableau de bord et le profil, actions.
 */
import { addWeighIn, isProfileValid, newProfile, removeWeighIn, targetsForProfile } from './profile.js';
import { clearState, emptyState, exportFileName, exportState, importState, loadState, saveState } from './store.js';
import { renderDashboard } from './ui/dashboard.js';
import { downloadTextFile, readFileAsText, toast } from './ui/dom.js';
import { readProfileForm, renderProfileForm, showFormErrors } from './ui/profile-form.js';

/** localStorage, ou une doublure en mémoire si le navigateur le refuse (mode privé strict). */
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
  dashboard: document.getElementById('view-dashboard'),
  profile: document.getElementById('view-profile'),
};
const importInput = document.getElementById('import-file');
const main = document.getElementById('main');

let state = loadState(storage);
let view = isProfileValid(state.profile) ? 'dashboard' : 'profile';

function commit(nextState) {
  state = saveState(nextState, storage);
  if (storage.volatile) toast('Stockage local indisponible : les données seront perdues à la fermeture.', 'error');
}

function show(nextView, { focus = true } = {}) {
  view = nextView;
  renderAll();
  if (focus) main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderAll() {
  const valid = isProfileValid(state.profile);
  if (view === 'dashboard' && !valid) view = 'profile';
  views.dashboard.hidden = view !== 'dashboard';
  views.profile.hidden = view !== 'profile';
  document.body.dataset.view = view;

  if (view === 'dashboard') {
    renderDashboard(views.dashboard, { profile: state.profile, targets: targetsForProfile(state.profile) });
  } else {
    renderProfileForm(views.profile, { profile: state.profile ?? newProfile(), isFirstRun: !valid });
  }
}

/* ---------- Actions ---------- */

function onSaveProfile(form) {
  const { profile, errors } = readProfileForm(form, state.profile ?? newProfile());
  showFormErrors(form, errors);
  if (errors.length > 0) return;
  const firstRun = !isProfileValid(state.profile);
  commit({ ...state, profile });
  show('dashboard');
  toast(firstRun ? 'Profil créé : voici tes cibles du jour.' : 'Profil enregistré, cibles recalculées.', 'success');
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
  toast('Pesée enregistrée, cibles recalculées.', 'success');
}

function onDeleteWeighIn(date) {
  if ((state.profile?.weights?.length ?? 0) <= 1) {
    toast('Garde au moins une pesée : modifie-la plutôt depuis le profil.', 'error');
    return;
  }
  commit({ ...state, profile: removeWeighIn(state.profile, date) });
  renderAll();
  toast('Pesée supprimée.');
}

function onExport() {
  try {
    downloadTextFile(exportFileName(), exportState(state));
    toast('Sauvegarde téléchargée.', 'success');
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
  const hasData = state.profile !== null;
  if (hasData && !window.confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
  commit(imported);
  show(isProfileValid(state.profile) ? 'dashboard' : 'profile');
  toast('Sauvegarde importée.', 'success');
}

function onReset() {
  if (!window.confirm('Effacer définitivement le profil et l’historique de poids de cet appareil ?')) return;
  clearState(storage);
  state = emptyState();
  show('profile');
  toast('Données effacées.');
}

/* ---------- Câblage ---------- */

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  switch (trigger.dataset.action) {
    case 'edit-profile':
      if (view !== 'profile') show('profile');
      break;
    case 'cancel-profile':
      if (isProfileValid(state.profile)) show('dashboard');
      break;
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
    default:
      break;
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

renderAll();
