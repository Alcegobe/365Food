/**
 * Formulaire de profil (première ouverture et modification) : rendu, lecture, erreurs, aperçu.
 */
import { ACTIVITY_LEVELS, GOALS, GOAL_ADJUST_RANGE, MACROS, PROFILE_LIMITS } from '../config.js';
import { parseDateParts } from '../nutrition.js';
import { addWeighIn, currentWeighIn, newProfile, targetsForProfile, todayISO, validateProfile } from '../profile.js';
import { fmt, html, render } from './dom.js';

const FIELD_ORDER = ['birthDate', 'sex', 'heightCm', 'weights', 'activity', 'goal', 'goalAdjustPct', 'weighInEveryDays', 'proteinPerKg', 'fatPerKg'];

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

function field({ name, label, hint, control }) {
  return html`
    <div class="field" data-field="${name}">
      <label class="field__label" for="f-${name}">${label}</label>
      ${control}
      ${hint ? html`<p class="field__hint" id="f-${name}-hint">${hint}</p>` : ''}
      <p class="field__error" id="f-${name}-error" aria-live="polite"></p>
    </div>
  `;
}

function numberInput({ name, value, unit, step = 1, min, max, inputmode = 'decimal', placeholder = '' }) {
  return html`
    <div class="with-unit">
      <input class="input" id="f-${name}" name="${name}" type="number" step="${step}" min="${min}" max="${max}"
             value="${value ?? ''}" placeholder="${placeholder}" inputmode="${inputmode}"
             aria-describedby="f-${name}-hint f-${name}-error">
      <span class="with-unit__unit" aria-hidden="true">${unit}</span>
    </div>
  `;
}

export function renderProfileForm(container, { profile, isFirstRun, today = new Date() }) {
  const p = profile ?? newProfile();
  const todayIso = todayISO(today);
  const current = currentWeighIn(p);
  const goalCfg = GOALS[p.goal] ?? GOALS.loss;

  render(
    container,
    html`
      ${isFirstRun
        ? html`
            <div class="welcome">
              <h2>Bienvenue !</h2>
              <p>Pour calculer tes besoins du jour (kcal, protéines, lipides, glucides) et ton budget de points,
                 il me faut quelques infos. Tout reste sur cet appareil.</p>
            </div>
          `
        : html`
            <div class="welcome">
              <h2>Ton profil</h2>
              <p>Les cibles se recalculent automatiquement après chaque modification.</p>
            </div>
          `}

      <form id="profile-form" class="form" novalidate data-goal="${p.goal}">
        <div class="form-summary" id="form-summary" role="alert" aria-live="assertive"></div>

        <fieldset>
          <legend>Toi</legend>
          <div class="fields fields--3">
            ${field({
              name: 'birthDate',
              label: 'Date de naissance',
              hint: "L'âge se calcule tout seul.",
              control: html`<input class="input" id="f-birthDate" name="birthDate" type="date" value="${p.birthDate ?? ''}" max="${todayIso}" aria-describedby="f-birthDate-hint f-birthDate-error">`,
            })}
            <div class="field" data-field="sex">
              <span class="field__label" id="sex-label">Sexe</span>
              <div class="choices" role="radiogroup" aria-labelledby="sex-label">
                <label class="choice"><input type="radio" name="sex" value="m" ${p.sex === 'm' ? 'checked' : ''}><span class="choice__title">Homme</span></label>
                <label class="choice"><input type="radio" name="sex" value="f" ${p.sex === 'f' ? 'checked' : ''}><span class="choice__title">Femme</span></label>
              </div>
              <p class="field__hint">Nécessaire à la formule de Mifflin-St Jeor.</p>
              <p class="field__error" id="f-sex-error" aria-live="polite"></p>
            </div>
            ${field({
              name: 'heightCm',
              label: 'Taille',
              control: numberInput({ name: 'heightCm', value: p.heightCm, unit: 'cm', min: PROFILE_LIMITS.heightCm.min, max: PROFILE_LIMITS.heightCm.max, inputmode: 'numeric' }),
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>Poids</legend>
          <div class="fields fields--2">
            ${field({
              name: 'weightKg',
              label: 'Poids',
              hint: 'Chaque nouvelle date ajoute une pesée à ton historique.',
              control: numberInput({ name: 'weightKg', value: current?.kg, unit: 'kg', step: 0.1, min: PROFILE_LIMITS.weightKg.min, max: PROFILE_LIMITS.weightKg.max }),
            })}
            ${field({
              name: 'weightDate',
              label: 'Date de la pesée',
              control: html`<input class="input" id="f-weightDate" name="weightDate" type="date" value="${current?.date ?? todayIso}" max="${todayIso}" aria-describedby="f-weightDate-hint f-weightDate-error">`,
            })}
          </div>
          <p class="field__error" id="f-weights-error" aria-live="polite"></p>
        </fieldset>

        <fieldset>
          <legend>Activité</legend>
          ${field({
            name: 'activity',
            label: "Niveau d'activité",
            hint: 'Sport et activité quotidienne confondus.',
            control: html`
              <select class="input" id="f-activity" name="activity" aria-describedby="f-activity-hint f-activity-error">
                ${ACTIVITY_LEVELS.map(
                  (level) => html`<option value="${level.factor}" ${level.factor === p.activity ? 'selected' : ''}>${level.label} — ${level.hint}</option>`,
                )}
              </select>
            `,
          })}
        </fieldset>

        <fieldset>
          <legend>Objectif</legend>
          <div class="field" data-field="goal">
            <span class="field__label" id="goal-label">Ce que tu vises</span>
            <div class="choices" role="radiogroup" aria-labelledby="goal-label">
              ${Object.entries(GOALS).map(
                ([id, g]) => html`
                  <label class="choice">
                    <input type="radio" name="goal" value="${id}" ${p.goal === id ? 'checked' : ''}>
                    <span class="choice__title">${g.label}</span>
                    <span class="choice__hint">${fmt.signed(g.defaultAdjustPct, ' %')} · ${fmt.dec2(g.proteinPerKg)} g/kg de protéines</span>
                  </label>
                `,
              )}
            </div>
            <p class="field__error" id="f-goal-error" aria-live="polite"></p>
          </div>
          <div class="fields fields--2" style="margin-top: 0.9rem">
            ${field({
              name: 'goalAdjustPct',
              label: 'Ajustement de la dépense',
              hint: `Négatif = déficit, positif = surplus (de ${GOAL_ADJUST_RANGE.min} à +${GOAL_ADJUST_RANGE.max} %). Par défaut ±15 %.`,
              control: numberInput({ name: 'goalAdjustPct', value: p.goalAdjustPct, unit: '%', step: 1, min: GOAL_ADJUST_RANGE.min, max: GOAL_ADJUST_RANGE.max, inputmode: 'numeric' }),
            })}
            ${field({
              name: 'weighInEveryDays',
              label: 'Rappel de pesée',
              hint: "Fréquence à laquelle l'app te redemandera ton poids.",
              control: numberInput({ name: 'weighInEveryDays', value: p.weighInEveryDays, unit: 'jours', step: 1, min: PROFILE_LIMITS.weighInEveryDays.min, max: PROFILE_LIMITS.weighInEveryDays.max, inputmode: 'numeric' }),
            })}
          </div>
        </fieldset>

        <details ${p.proteinPerKg !== null || p.fatPerKg !== null ? 'open' : ''}>
          <summary>Réglages avancés (macros)</summary>
          <div class="fields fields--2">
            ${field({
              name: 'proteinPerKg',
              label: 'Protéines',
              hint: "Laisse vide pour la valeur par défaut de l'objectif.",
              control: numberInput({ name: 'proteinPerKg', value: p.proteinPerKg, unit: 'g/kg', step: 0.1, min: PROFILE_LIMITS.proteinPerKg.min, max: PROFILE_LIMITS.proteinPerKg.max, placeholder: String(goalCfg.proteinPerKg) }),
            })}
            ${field({
              name: 'fatPerKg',
              label: 'Lipides',
              hint: 'Laisse vide pour la valeur par défaut.',
              control: numberInput({ name: 'fatPerKg', value: p.fatPerKg, unit: 'g/kg', step: 0.1, min: PROFILE_LIMITS.fatPerKg.min, max: PROFILE_LIMITS.fatPerKg.max, placeholder: String(MACROS.fatPerKg) }),
            })}
          </div>
        </details>

        <p class="preview preview--empty" id="profile-preview" aria-live="polite"></p>

        <div class="form__actions">
          <button type="submit" class="btn btn--primary">${isFirstRun ? 'Calculer mes cibles' : 'Enregistrer'}</button>
          ${isFirstRun ? '' : html`<button type="button" class="btn btn--ghost" data-action="cancel-profile">Annuler</button>`}
        </div>
      </form>
    `,
  );

  const form = container.querySelector('#profile-form');
  attachBehaviour(form, p, today);
  updatePreview(form, p, today);
  return form;
}

/**
 * Lit le formulaire et construit un profil à partir du profil de base.
 * Retourne { profile, errors } ; `errors` est vide si le profil est valide.
 */
export function readProfileForm(form, baseProfile, today = new Date()) {
  const data = new FormData(form);
  const errors = [];

  const heightCm = numberOrNull(data.get('heightCm'));
  const goalAdjustPct = numberOrNull(data.get('goalAdjustPct'));
  const weighInEveryDays = numberOrNull(data.get('weighInEveryDays'));
  const proteinPerKg = numberOrNull(data.get('proteinPerKg'));
  const fatPerKg = numberOrNull(data.get('fatPerKg'));

  let profile = {
    ...(baseProfile ?? newProfile()),
    birthDate: String(data.get('birthDate') ?? '').trim(),
    sex: data.get('sex'),
    heightCm: Number.isNaN(heightCm) ? null : heightCm,
    activity: Number(data.get('activity')),
    goal: data.get('goal'),
    goalAdjustPct: Number.isNaN(goalAdjustPct) ? null : goalAdjustPct,
    weighInEveryDays: Number.isNaN(weighInEveryDays) ? null : weighInEveryDays,
    proteinPerKg: Number.isNaN(proteinPerKg) ? NaN : proteinPerKg,
    fatPerKg: Number.isNaN(fatPerKg) ? NaN : fatPerKg,
  };

  const weightKg = numberOrNull(data.get('weightKg'));
  const weightDate = String(data.get('weightDate') ?? '').trim() || todayISO(today);
  if (weightKg === null) {
    errors.push({ field: 'weights', message: 'Indique ton poids.' });
  } else if (!parseDateParts(weightDate)) {
    errors.push({ field: 'weights', message: 'Date de pesée invalide.' });
  } else {
    try {
      profile = addWeighIn(profile, { date: weightDate, kg: weightKg });
    } catch (err) {
      errors.push({ field: 'weights', message: err.message });
    }
  }

  const seen = new Set(errors.map((e) => e.field));
  for (const error of validateProfile(profile, today)) {
    if (!seen.has(error.field)) {
      errors.push(error);
      seen.add(error.field);
    }
  }
  errors.sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
  return { profile, errors };
}

/** Affiche les erreurs sous les champs et dans le résumé (vide = tout effacer). */
export function showFormErrors(form, errors) {
  form.querySelectorAll('.field__error').forEach((el) => {
    el.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

  const summary = form.querySelector('#form-summary');
  if (errors.length === 0) {
    summary.textContent = '';
    return;
  }

  for (const { field: name, message } of errors) {
    const target = form.querySelector(`#f-${name}-error`);
    if (target) target.textContent = message;
    const inputName = name === 'weights' ? 'weightKg' : name;
    form.querySelectorAll(`[name="${inputName}"]`).forEach((input) => input.setAttribute('aria-invalid', 'true'));
  }

  render(
    summary,
    html`
      <strong>${errors.length === 1 ? 'Un champ à corriger :' : `${errors.length} champs à corriger :`}</strong>
      <ul>${errors.map((e) => html`<li>${e.message}</li>`)}</ul>
    `,
  );
  const first = errors[0];
  const focusTarget = form.querySelector(`[name="${first.field === 'weights' ? 'weightKg' : first.field}"]`);
  focusTarget?.focus();
}

/** Aperçu des cibles en direct sous le formulaire. */
export function updatePreview(form, baseProfile, today = new Date()) {
  const preview = form.querySelector('#profile-preview');
  if (!preview) return;
  const { profile, errors } = readProfileForm(form, baseProfile, today);
  const targets = errors.length === 0 ? targetsForProfile(profile, today) : null;
  if (!targets) {
    preview.className = 'preview preview--empty';
    preview.textContent = 'Complète le formulaire pour voir tes cibles.';
    return;
  }
  preview.className = 'preview';
  preview.textContent = `Aperçu : ${fmt.kcal(targets.kcal)} · ${fmt.g(targets.proteinG)} de protéines · ${fmt.points(targets.dailyPoints)} par jour`
    + (targets.belowFloor ? ` (plancher de sécurité ${fmt.kcal(targets.floor)} appliqué)` : '');
}

function attachBehaviour(form, baseProfile, today) {
  form.addEventListener('change', (event) => {
    if (event.target.name !== 'goal') return;
    const previousGoal = form.dataset.goal;
    const nextGoal = event.target.value;
    const pctInput = form.elements.goalAdjustPct;
    const previousDefault = GOALS[previousGoal]?.defaultAdjustPct;
    if (pctInput.value === '' || Number(pctInput.value) === previousDefault) {
      pctInput.value = String(GOALS[nextGoal].defaultAdjustPct);
    }
    form.elements.proteinPerKg.placeholder = String(GOALS[nextGoal].proteinPerKg);
    form.dataset.goal = nextGoal;
  });
  form.addEventListener('input', () => updatePreview(form, baseProfile, today));
  form.addEventListener('change', () => updatePreview(form, baseProfile, today));
}
