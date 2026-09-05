/**
 * Tableau de bord : cibles du jour, budget de la semaine, pesées, profil, données.
 */
import { GOALS, PROFILE_LIMITS } from '../config.js';
import { activityLevel } from '../nutrition.js';
import { currentWeighIn, todayISO } from '../profile.js';
import { fmt, html, render } from './dom.js';

export function renderDashboard(container, { profile, targets, today = new Date() }) {
  const todayIso = todayISO(today);
  const current = currentWeighIn(profile);
  const goal = GOALS[targets.goal];
  const level = activityLevel(targets.activityFactor);
  const history = [...profile.weights].sort((a, b) => b.date.localeCompare(a.date));
  const recent = history.slice(0, 6);

  render(
    container,
    html`
      ${targets.belowFloor
        ? html`
            <div class="alert alert--warn" role="alert">
              <span class="alert__icon" aria-hidden="true">⚠️</span>
              <p>
                Ta cible calculée (${fmt.kcal(Math.round(targets.rawKcal))}) passait sous le plancher de sécurité.
                Elle a été relevée à <strong>${fmt.kcal(targets.floor)}</strong>. Réduis le déficit ou vérifie ton profil.
              </p>
            </div>
          `
        : ''}
      ${targets.carbsClamped
        ? html`
            <div class="alert alert--warn" role="alert">
              <span class="alert__icon" aria-hidden="true">⚠️</span>
              <p>Avec ces quantités de protéines et de lipides, il ne reste plus de place pour les glucides. Baisse les g/kg dans les réglages avancés.</p>
            </div>
          `
        : ''}

      <section class="card hero" aria-labelledby="today-title">
        <p class="hero__date">${fmt.weekdayDate(todayIso)}</p>
        <h2 class="hero__title" id="today-title">Aujourd'hui</h2>
        <p class="hero__points">
          <span class="hero__points-value">${fmt.dec(targets.dailyPoints)}</span>
          <span class="hero__points-unit">${targets.dailyPoints >= 2 ? 'points' : 'point'} à dépenser</span>
        </p>
        <ul class="stat-grid" aria-label="Cibles du jour">
          <li class="stat"><span class="stat__label">Énergie</span><span class="stat__value">${fmt.int(targets.kcal)}</span><span class="stat__unit">kcal</span></li>
          <li class="stat stat--accent"><span class="stat__label">Protéines</span><span class="stat__value">${fmt.int(targets.proteinG)}</span><span class="stat__unit">g</span></li>
          <li class="stat"><span class="stat__label">Lipides</span><span class="stat__value">${fmt.int(targets.fatG)}</span><span class="stat__unit">g</span></li>
          <li class="stat"><span class="stat__label">Glucides</span><span class="stat__value">${fmt.int(targets.carbsG)}</span><span class="stat__unit">g</span></li>
        </ul>
        <p class="hero__line">
          Aujourd'hui : ${fmt.int(targets.kcal)} kcal · P ${fmt.int(targets.proteinG)} g · L ${fmt.int(targets.fatG)} g ·
          G ${fmt.int(targets.carbsG)} g · <strong>${fmt.points(targets.dailyPoints)}</strong>
        </p>
        <p class="hero__hint">Fibres : ${targets.fiberMinG} à ${targets.fiberMaxG} g par jour (indicatif).</p>
      </section>

      <div class="grid">
        <div class="grid__col">
          <section class="card" aria-labelledby="week-title">
            <h2 class="card__title" id="week-title">Cette semaine</h2>
            <p class="big">${fmt.dec(targets.weeklyPoints)} <span class="unit">points</span></p>
            <p class="muted">7 × ${fmt.dec(targets.dailyPoints)} + 10 % de jokers pour un resto ou une soirée.</p>
          </section>

          <section class="card" aria-labelledby="weight-title">
            <h2 class="card__title" id="weight-title">Pesées</h2>
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
              <button type="submit" class="btn btn--primary">Ajouter</button>
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
                    <button type="button" class="btn btn--ghost btn--icon" data-action="delete-weigh-in" data-date="${entry.date}"
                            aria-label="Supprimer la pesée du ${fmt.date(entry.date)}">×</button>
                  </li>
                `;
              })}
            </ol>
            ${history.length > recent.length ? html`<p class="muted small">${history.length} pesées au total, les ${recent.length} dernières sont affichées.</p>` : ''}
          </section>
        </div>

        <div class="grid__col">
          <section class="card" aria-labelledby="profile-title">
            <h2 class="card__title" id="profile-title">Ton profil</h2>
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
            <button type="button" class="btn" data-action="edit-profile">Modifier le profil</button>
          </section>

          <section class="card" aria-labelledby="data-title">
            <h2 class="card__title" id="data-title">Tes données</h2>
            <p class="card__lead">Tout est stocké dans ce navigateur. Exporte une sauvegarde pour changer d'appareil ou par sécurité.</p>
            <div class="btn-row">
              <button type="button" class="btn" data-action="export">Exporter (JSON)</button>
              <button type="button" class="btn" data-action="import">Importer…</button>
              <button type="button" class="btn btn--danger" data-action="reset">Tout effacer</button>
            </div>
          </section>
        </div>
      </div>
    `,
  );
}
