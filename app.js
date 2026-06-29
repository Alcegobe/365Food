// 365Food — PWA statique. Recettes maison + assistant "Manger dehors".

const REPAS_LABELS = {
  all: "Tout",
  dejeuner: "🍳 Déjeuner",
  diner: "🍽️ Dîner",
  souper: "🌙 Souper",
  sauce: "🥣 Sauces",
  dessert: "🍰 Desserts",
  snack: "🥨 Petits creux",
};
const REPAS_ORDER = ["all", "dejeuner", "diner", "souper", "sauce", "dessert", "snack"];

const SEASON_LABELS = {
  toutes: "Toutes",
  printemps: "🌱 Printemps",
  ete: "☀️ Été",
  automne: "🍂 Automne",
  hiver: "❄️ Hiver",
};

const state = { repas: "all", saison: "toutes", query: "", restoQuery: "" };
let DATA = null;
let CAT_BY_ID = new Map();
let RECIPE_BY_ID = new Map();
let RESTO = null;

const $ = (sel) => document.querySelector(sel);
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function currentSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "printemps";
  if (m >= 6 && m <= 8) return "ete";
  if (m >= 9 && m <= 11) return "automne";
  return "hiver";
}

/* ---------- Onglets ---------- */
function switchView(view) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.setAttribute("aria-selected", String(tab.dataset.view === view));
  }
  $("#view-recettes").hidden = view !== "recettes";
  $("#view-semaine").hidden = view !== "semaine";
  $("#view-courses").hidden = view !== "courses";
  $("#view-resto").hidden = view !== "resto";
  if (view === "resto" && RESTO === null) loadResto();
  if (view === "semaine") renderSemaine();
  if (view === "courses") renderCourses();
}
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
}

/* ---------- Recettes ---------- */
async function load() {
  try {
    const res = await fetch("./data/recipes.json", { cache: "no-cache" });
    DATA = await res.json();
  } catch (e) {
    $("#results").innerHTML = `<p class="empty">Impossible de charger les recettes. ${e}</p>`;
    return;
  }
  CAT_BY_ID = new Map(DATA.categories.map((c) => [c.id, c]));
  RECIPE_BY_ID = new Map(DATA.recipes.map((r) => [r.id, r]));
  buildRepasFilter();
  buildSeasonFilter();
  render();
  if (pendingSemaine) renderSemaine();
}

function buildRepasFilter() {
  const wrap = $("#repas-filter");
  wrap.innerHTML = "";
  for (const key of REPAS_ORDER) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = REPAS_LABELS[key];
    b.setAttribute("aria-pressed", String(state.repas === key));
    b.onclick = () => {
      state.repas = key;
      buildRepasFilter();
      render();
    };
    wrap.appendChild(b);
  }
}

function buildSeasonFilter() {
  const sel = $("#season-filter");
  sel.innerHTML = "";
  const cur = currentSeason();
  for (const key of Object.keys(SEASON_LABELS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = key === cur ? `${SEASON_LABELS[key]} (actuelle)` : SEASON_LABELS[key];
    sel.appendChild(o);
  }
  sel.value = state.saison;
  sel.onchange = () => {
    state.saison = sel.value;
    render();
  };
}

function matches(recipe) {
  const cat = CAT_BY_ID.get(recipe.categorie);
  if (!cat) return false;
  if (state.repas !== "all" && !cat.repas.includes(state.repas)) return false;
  if (state.saison !== "toutes") {
    const s = recipe.saisons;
    if (!s.includes("toute_annee") && !s.includes(state.saison)) return false;
  }
  if (state.query) {
    const q = norm(state.query);
    if (!norm(recipe.titre).includes(q) && !norm(cat.label).includes(q)) return false;
  }
  return true;
}

function highlight(text) {
  if (!state.query) return esc(text);
  const q = norm(state.query);
  const n = norm(text);
  const i = n.indexOf(q);
  if (i < 0) return esc(text);
  return (
    esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + state.query.length)) + "</mark>" + esc(text.slice(i + state.query.length))
  );
}

function render() {
  const visible = DATA.recipes.filter(matches);
  $("#count").textContent =
    visible.length + (visible.length > 1 ? " recettes" : " recette");

  const results = $("#results");
  if (visible.length === 0) {
    results.innerHTML = `<p class="empty">Aucune recette pour ces filtres. 🤷</p>`;
    return;
  }

  const byCat = new Map();
  for (const r of visible) {
    if (!byCat.has(r.categorie)) byCat.set(r.categorie, []);
    byCat.get(r.categorie).push(r);
  }

  const frag = document.createDocumentFragment();
  for (const cat of DATA.categories) {
    const items = byCat.get(cat.id);
    if (!items) continue;

    const block = document.createElement("section");
    block.className = "cat-block";
    block.innerHTML = `<h2 class="cat-title">${esc(cat.label)} <span class="n">${items.length}</span></h2>`;

    const cards = document.createElement("div");
    cards.className = "cards";
    for (const r of items) {
      const seasonBadges = r.saisons.includes("toute_annee")
        ? ""
        : r.saisons
            .map((s) => `<span class="badge season">${SEASON_LABELS[s] ?? s}</span>`)
            .join("");
      const comp = r.composantes
        ? `<div class="card-comp">${compLabels(r.composantes)}</div>`
        : "";
      const card = document.createElement("article");
      card.className = "card card-link";
      card.dataset.id = r.id;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Voir la recette : ${r.titre}`);
      card.innerHTML =
        `<svg class="ico card-chevron" aria-hidden="true"><use href="#i-chevron" /></svg>` +
        `<div class="card-title">${highlight(r.titre)}</div>` +
        comp +
        (r.macros ? macrosRow(r.macros) : "") +
        (seasonBadges ? `<div class="badges">${seasonBadges}</div>` : "");
      cards.appendChild(card);
    }
    block.appendChild(cards);
    frag.appendChild(block);
  }
  results.replaceChildren(frag);
}

$("#search").addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

/* ---------- Composantes (étiquettes texte) ---------- */
function compLabels(c) {
  const parts = [];
  if (c.proteine && c.proteine !== "—")
    parts.push(`<span class="comp-k">Protéine</span> ${esc(c.proteine)}`);
  if (c.legume && c.legume !== "—")
    parts.push(`<span class="comp-k">Légume</span> ${esc(c.legume)}`);
  if (c.feculent && c.feculent !== "—")
    parts.push(`<span class="comp-k">Féculent</span> ${esc(c.feculent)}`);
  return parts.join(" · ");
}

/* ---------- Fiche recette (au clic) ---------- */
let sheetEl = null;
let sheetPrevFocus = null;

function searchUrl(titre) {
  return "https://www.google.com/search?q=" + encodeURIComponent("recette " + titre);
}

function recipeSheetHTML(r) {
  let h = "";
  if (r.composantes) h += `<div class="sheet-comp">${compLabels(r.composantes)}</div>`;
  if (r.macros) h += macrosRow(r.macros);
  if (r.ingredients && r.ingredients.length) {
    h +=
      `<h3 class="sheet-h">Ingrédients <span class="sheet-sub">pour 1 personne</span></h3>` +
      `<ul class="sheet-ingr">` +
      r.ingredients
        .map(
          (i) =>
            `<li><span class="ing-name">${esc(i.item)}</span>` +
            `<span class="ing-qty">${i.qty} ${esc(i.unit || "")}</span></li>`
        )
        .join("") +
      `</ul>`;
  }
  if (r.etapes && r.etapes.length) {
    h +=
      `<h3 class="sheet-h">Préparation</h3>` +
      `<ol class="sheet-steps">` +
      r.etapes.map((s) => `<li>${esc(s)}</li>`).join("") +
      `</ol>`;
  } else {
    h += `<p class="sheet-todo">Recette détaillée bientôt disponible — en attendant, ouvre la recherche ci-dessous. 👇</p>`;
  }
  h +=
    `<a class="btn sheet-search" href="${searchUrl(r.titre)}" target="_blank" rel="noopener">` +
    `<svg class="ico"><use href="#i-search" /></svg><span class="btn-lbl">Chercher la recette sur le web</span></a>`;
  return h;
}

function openRecipe(id) {
  const r = RECIPE_BY_ID.get(id);
  if (!r) return;
  if (!sheetEl) {
    sheetEl = document.createElement("div");
    sheetEl.className = "sheet-backdrop";
    sheetEl.hidden = true;
    sheetEl.addEventListener("click", (e) => {
      if (e.target === sheetEl) closeRecipe();
    });
    document.body.appendChild(sheetEl);
  }
  sheetPrevFocus = document.activeElement;
  sheetEl.innerHTML =
    `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">` +
    `<header class="sheet-head">` +
    `<h2 id="sheet-title">${esc(r.titre)}</h2>` +
    `<button class="sheet-close" type="button" aria-label="Fermer"><svg class="ico"><use href="#i-close" /></svg></button>` +
    `</header>` +
    `<div class="sheet-body">${recipeSheetHTML(r)}</div>` +
    `</div>`;
  sheetEl.hidden = false;
  document.body.style.overflow = "hidden";
  const closeBtn = sheetEl.querySelector(".sheet-close");
  closeBtn.addEventListener("click", closeRecipe);
  closeBtn.focus();
}

function closeRecipe() {
  if (!sheetEl || sheetEl.hidden) return;
  sheetEl.hidden = true;
  document.body.style.overflow = "";
  if (sheetPrevFocus && sheetPrevFocus.focus) sheetPrevFocus.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRecipe();
});

// Délégation clic / clavier sur les cartes recette.
$("#results").addEventListener("click", (e) => {
  const card = e.target.closest(".card-link");
  if (card) openRecipe(card.dataset.id);
});
$("#results").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".card-link");
  if (card) {
    e.preventDefault();
    openRecipe(card.dataset.id);
  }
});

/* ---------- Manger dehors ---------- */
async function loadResto() {
  try {
    const res = await fetch("./data/resto.json", { cache: "no-cache" });
    RESTO = await res.json();
  } catch (e) {
    $("#resto").innerHTML = `<p class="empty">Impossible de charger le guide. ${e}</p>`;
    return;
  }
  renderResto();
}

function macrosRow(m) {
  return (
    `<div class="macros">` +
    `<span class="macro kcal">${m.kcal} kcal</span>` +
    `<span class="macro p">P ${m.proteines} g</span>` +
    `<span class="macro g">G ${m.glucides} g</span>` +
    `<span class="macro l">L ${m.lipides} g</span>` +
    `</div>`
  );
}

function pickBlock(cls, label, pick) {
  return (
    `<div class="pick ${cls}">` +
    `<span class="pick-label">${label}</span>` +
    `<div class="pick-nom">${esc(pick.nom)}</div>` +
    macrosRow(pick.macros) +
    `<p class="pick-why">${esc(pick.pourquoi)}</p>` +
    `</div>`
  );
}

function renderResto() {
  const root = $("#resto");
  const q = norm(state.restoQuery);
  const list = RESTO.enseignes.filter(
    (e) => !q || norm(e.nom).includes(q) || (e.tags || []).some((t) => norm(t).includes(q))
  );

  const frag = document.createDocumentFragment();

  // Bandeau philosophie (visible seulement sans recherche).
  if (!q) {
    const intro = document.createElement("section");
    intro.className = "resto-intro";
    intro.innerHTML =
      `<p class="resto-intro-lead">${esc(RESTO.meta.intro)}</p>` +
      `<ul class="resto-principes">${RESTO.meta.principes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
    frag.appendChild(intro);
  }

  if (list.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Enseigne pas encore listée — applique les principes du haut : protéine + un peu de vert, sauce à part, soda zéro. 😉";
    frag.appendChild(p);
  }

  for (const e of list) {
    const card = document.createElement("details");
    card.className = "resto-card";
    if (q) card.open = true;
    card.innerHTML =
      `<summary><span class="resto-emoji">${e.emoji ?? "🍽️"}</span><span class="resto-nom">${esc(e.nom)}</span></summary>` +
      `<div class="resto-body">` +
      pickBlock("optimal", "✅ Choix optimal", e.optimal) +
      pickBlock("alt", "🔁 Alternative", e.alternative) +
      `<p class="astuce">⬆️ <strong>Upgrade :</strong> ${esc(e.astuce)}</p>` +
      (e.vigilance ? `<p class="vigilance">⚠️ <strong>À éviter :</strong> ${esc(e.vigilance)}</p>` : "") +
      `</div>`;
    frag.appendChild(card);
  }

  if (RESTO.meta.disclaimer) {
    const d = document.createElement("p");
    d.className = "resto-disclaimer";
    d.textContent = RESTO.meta.disclaimer;
    frag.appendChild(d);
  }

  root.replaceChildren(frag);
}

$("#resto-search").addEventListener("input", (e) => {
  state.restoQuery = e.target.value.trim();
  if (RESTO) renderResto();
});

/* ---------- Ma semaine (planificateur 7 jours) ---------- */
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
let pendingSemaine = false;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() * 100 + week;
}

function mondayOf(d = new Date()) {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day);
  t.setHours(0, 0, 0, 0);
  return t;
}

const dm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const hasIngr = (r) => Array.isArray(r.ingredients) && r.ingredients.length > 0;

// Catégories "plaisir" (fast-food revisité) que l'on espace dans la semaine.
const PLAISIR_CATS = new Set(["burgers", "friterie", "kebab", "pizzas"]);
const isPlaisir = (r) => PLAISIR_CATS.has(r.categorie);

// Type de protéine, déduit de la catégorie + du titre (pour varier les repas).
function proteinType(r) {
  const t = norm(r.titre);
  if (r.categorie === "poissons") return "poisson";
  if (r.categorie === "crevettes-fruits-mer") return "fruits_mer";
  if (/crevette|gambas|scampi|moule|fruits de mer/.test(t)) return "fruits_mer";
  if (/saumon|cabillaud|thon|truite|colin|maquereau|sole|\bbar\b|lieu|poisson|fish/.test(t)) return "poisson";
  if (/poulet|dinde|volaille|kebab|chicken/.test(t)) return "volaille";
  if (/oeuf|œuf|omelette|frittata|shakshuka|quiche/.test(t)) return "oeuf";
  if (/porc|lard|jambon|bacon|cordon/.test(t)) return "porc";
  if (/boeuf|bœuf|steak|hache|haché|bolognaise|carbonnade|chili|burger|mijote|mijoté/.test(t)) return "boeuf";
  if (/haricot|vege|végé|legume|légume|courgette|chou/.test(t)) return "vege";
  if (r.categorie === "burgers") return "boeuf";
  if (r.categorie === "kebab") return "volaille";
  return "autre";
}

function poolFor(catSet, seasonalOnly, detailOnly) {
  const cur = currentSeason();
  return DATA.recipes.filter(
    (r) =>
      catSet.has(r.categorie) &&
      (!seasonalOnly || r.saisons.includes("toute_annee") || r.saisons.includes(cur)) &&
      (!detailOnly || hasIngr(r))
  );
}

// Choisit dans le pool un plat respectant au mieux les contraintes (variété
// protéines, plats "plaisir" espacés), sans répétition.
function pickMain(pool, used, ctx) {
  const candidates = pool.filter((r) => !used.has(r.id));
  if (!candidates.length) return null;
  const ok = (r, strict) => {
    const pt = proteinType(r);
    if (ctx.partnerType && pt === ctx.partnerType) return false; // même protéine le même jour
    if (isPlaisir(r)) {
      if (ctx.partnerPlaisir) return false; // pas 2 plaisirs le même jour
      if (ctx.plaisirCount >= 5) return false; // ~5 max / semaine
      if (strict && ctx.prevPlaisir) return false; // pas 2 plaisirs d'affilée
    }
    if (strict && ctx.prevType && pt === ctx.prevType) return false; // varier vs repas précédent
    return true;
  };
  return candidates.find((r) => ok(r, true)) || candidates.find((r) => ok(r, false)) || candidates[0];
}

function buildWeek(salt, seasonalOnly, detailOnly) {
  const dejCats = new Set(DATA.categories.filter((c) => c.repas.includes("dejeuner")).map((c) => c.id));
  const mainCats = new Set(
    DATA.categories.filter((c) => c.repas.includes("diner") || c.repas.includes("souper")).map((c) => c.id)
  );
  const rng = mulberry32((isoWeekKey() * 131 + salt * 977) >>> 0);
  const dej = shuffle(poolFor(dejCats, seasonalOnly, detailOnly), rng);
  let mainsPool = shuffle(poolFor(mainCats, seasonalOnly, detailOnly), rng);
  if (mainsPool.length < 14) mainsPool = shuffle(poolFor(mainCats, seasonalOnly, false), rng); // garde-fou

  const usedMains = new Set();
  let plaisirCount = 0;
  let prevType = null;
  let prevPlaisir = false;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const diner = pickMain(mainsPool, usedMains, { plaisirCount, prevType, prevPlaisir });
    if (diner) {
      usedMains.add(diner.id);
      if (isPlaisir(diner)) plaisirCount++;
      prevType = proteinType(diner);
      prevPlaisir = isPlaisir(diner);
    }
    const souper = pickMain(mainsPool, usedMains, {
      plaisirCount,
      prevType,
      prevPlaisir,
      partnerType: diner ? proteinType(diner) : null,
      partnerPlaisir: diner ? isPlaisir(diner) : false,
    });
    if (souper) {
      usedMains.add(souper.id);
      if (isPlaisir(souper)) plaisirCount++;
      prevType = proteinType(souper);
      prevPlaisir = isPlaisir(souper);
    }
    days.push({
      dejeuner: dej.length ? dej[i % dej.length] : null,
      diner: diner || null,
      souper: souper || null,
    });
  }
  return days;
}

function getSemaineState() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem("semaine365"));
  } catch (e) {
    /* ignore */
  }
  const wk = isoWeekKey();
  if (!s || s.week !== wk) s = { week: wk, salt: 0, seasonal: true, detail: false };
  if (s.detail === undefined) s.detail = false;
  return s;
}
function saveSemaineState(s) {
  try {
    localStorage.setItem("semaine365", JSON.stringify(s));
  } catch (e) {
    /* ignore */
  }
}

let SEMAINE_DAYS = null;
let SEMAINE_SIG = null;
const semaineSig = (s) => `${s.week}:${s.salt}:${s.seasonal}:${s.detail}`;

// Construit (ou réutilise) la semaine pour l'état courant : garantit que
// "Ma semaine" et "Courses" affichent exactement le même planning.
function ensureWeek() {
  if (!DATA) return false;
  const s = getSemaineState();
  const sig = semaineSig(s);
  if (!SEMAINE_DAYS || SEMAINE_SIG !== sig) {
    SEMAINE_DAYS = buildWeek(s.salt, s.seasonal, s.detail);
    SEMAINE_SIG = sig;
  }
  return true;
}

function renderSemaine() {
  const root = $("#semaine");
  if (!ensureWeek()) {
    pendingSemaine = true;
    root.innerHTML = `<p class="loading">Chargement…</p>`;
    return;
  }
  pendingSemaine = false;

  const s = getSemaineState();
  $("#semaine-seasonal").checked = s.seasonal;
  const detailEl = $("#semaine-detail");
  if (detailEl) detailEl.checked = s.detail;

  const mon = mondayOf();
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  $("#semaine-info").innerHTML =
    `<strong>Semaine du ${dm(mon)} au ${dm(sun)}</strong>` +
    `<span class="semaine-sub">${s.seasonal ? "🇧🇪 de saison" : "toutes saisons"}${s.detail ? " · détaillées" : ""} · 7 jours</span>`;

  const frag = document.createDocumentFragment();
  SEMAINE_DAYS.forEach((day, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    const line = (ico, label, r) =>
      `<div class="repas-line"><span class="repas-ico">${ico}</span>` +
      `<span class="repas-txt"><span class="repas-label">${label}</span>${r ? esc(r.titre) : "—"}</span></div>`;

    const meals = [day.dejeuner, day.diner, day.souper];
    let kcal = 0, prot = 0, withMacros = 0;
    for (const r of meals) {
      if (r && r.macros) {
        kcal += r.macros.kcal;
        prot += r.macros.proteines;
        withMacros++;
      }
    }
    const total =
      withMacros > 0
        ? `<div class="jour-total">≈ ${kcal} kcal · ${prot} g protéines${withMacros < 3 ? " <span class=\"jour-total-note\">(repas détaillés)</span>" : ""}</div>`
        : "";

    const sec = document.createElement("section");
    sec.className = "jour";
    sec.innerHTML =
      `<h3 class="jour-titre">${JOURS[i]} <span class="jour-date">${dm(d)}</span></h3>` +
      line("🍳", "Déjeuner", day.dejeuner) +
      line("🍽️", "Dîner", day.diner) +
      line("🌙", "Souper", day.souper) +
      total;
    frag.appendChild(sec);
  });
  root.replaceChildren(frag);
}

function semaineToText() {
  if (!SEMAINE_DAYS) return "";
  const mon = mondayOf();
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const lines = [`🍽️ Ma semaine 365Food (du ${dm(mon)} au ${dm(sun)})`, ""];
  SEMAINE_DAYS.forEach((day, i) => {
    lines.push(JOURS[i]);
    lines.push(`  🍳 ${day.dejeuner ? day.dejeuner.titre : "—"}`);
    lines.push(`  🍽️ ${day.diner ? day.diner.titre : "—"}`);
    lines.push(`  🌙 ${day.souper ? day.souper.titre : "—"}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

$("#semaine-regen").addEventListener("click", () => {
  const s = getSemaineState();
  s.salt = (s.salt + 1) % 100000;
  saveSemaineState(s);
  renderSemaine();
});

$("#semaine-seasonal").addEventListener("change", (e) => {
  const s = getSemaineState();
  s.seasonal = e.target.checked;
  saveSemaineState(s);
  renderSemaine();
});

$("#semaine-detail").addEventListener("change", (e) => {
  const s = getSemaineState();
  s.detail = e.target.checked;
  saveSemaineState(s);
  renderSemaine();
});

// Affiche brièvement un message dans le label d'un bouton (sans écraser l'icône).
function flashBtn(btn, msg) {
  const lbl = btn.querySelector(".btn-lbl") || btn;
  if (!lbl.dataset.orig) lbl.dataset.orig = lbl.textContent;
  lbl.textContent = msg;
  setTimeout(() => {
    lbl.textContent = lbl.dataset.orig;
  }, 1800);
}

$("#semaine-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(semaineToText());
    flashBtn($("#semaine-copy"), "Copié ✓");
  } catch (e) {
    flashBtn($("#semaine-copy"), "Échec");
  }
});

/* ---------- Courses (liste auto depuis la semaine) ---------- */
const COURSES_RAYONS = [
  "Fruits & légumes",
  "Boucherie & volaille",
  "Poissonnerie",
  "Crémerie & œufs",
  "Boulangerie",
  "Épicerie",
  "Sauces & condiments",
  "Surgelés",
  "Autre",
];

const fmtQty = (q) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

function coursesKey() {
  const s = getSemaineState();
  return `courses365:${semaineSig(s)}`;
}
function getChecked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(coursesKey())) || []);
  } catch (e) {
    return new Set();
  }
}
function saveChecked(set) {
  try {
    localStorage.setItem(coursesKey(), JSON.stringify([...set]));
  } catch (e) {
    /* ignore */
  }
}

// Agrège les ingrédients de la semaine en fusionnant les doublons.
function aggregateCourses() {
  const recipes = [];
  for (const day of SEMAINE_DAYS) for (const m of [day.dejeuner, day.diner, day.souper]) if (m) recipes.push(m);
  const detailed = recipes.filter(hasIngr);
  const missing = recipes.filter((r) => !hasIngr(r));

  const map = new Map();
  for (const r of detailed) {
    for (const ing of r.ingredients) {
      const rayon = ing.rayon || "Autre";
      const key = norm(ing.item) + "|" + (ing.unit || "") + "|" + rayon;
      if (!map.has(key)) map.set(key, { key, item: ing.item, unit: ing.unit || "", rayon, qty: 0, hasQty: true });
      const o = map.get(key);
      if (typeof ing.qty === "number") o.qty += ing.qty;
      else o.hasQty = false;
    }
  }
  return { items: [...map.values()], detailed, missing, total: recipes.length };
}

function renderCourses() {
  const root = $("#courses");
  if (!ensureWeek()) {
    root.innerHTML = `<p class="loading">Chargement…</p>`;
    return;
  }
  const { items, detailed, missing, total } = aggregateCourses();
  const checked = getChecked();

  const doneCount = () => items.filter((it) => getChecked().has(it.key)).length;
  const refreshProgress = () => {
    const done = doneCount();
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const bar = $("#courses-progress-fill");
    const lbl = $("#courses-progress-lbl");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = `${done}/${items.length} dans le panier`;
  };

  $("#courses-info").innerHTML =
    `<strong>Liste de courses</strong>` +
    `<span class="semaine-sub">${detailed.length}/${total} repas détaillés · ${items.length} ingrédients</span>` +
    (items.length
      ? `<div class="progress"><div class="progress-track"><div class="progress-fill" id="courses-progress-fill"></div></div>` +
        `<span class="progress-lbl" id="courses-progress-lbl"></span></div>`
      : "");

  const frag = document.createDocumentFragment();

  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.innerHTML =
      "Aucun ingrédient détaillé dans cette semaine.<br>Active « Recettes détaillées » dans 📅 Ma semaine pour une liste complète.";
    frag.appendChild(p);
  }

  const byRayon = new Map();
  for (const it of items) {
    if (!byRayon.has(it.rayon)) byRayon.set(it.rayon, []);
    byRayon.get(it.rayon).push(it);
  }
  for (const rayon of COURSES_RAYONS) {
    const list = byRayon.get(rayon);
    if (!list) continue;
    list.sort((a, b) => a.item.localeCompare(b.item, "fr"));
    const block = document.createElement("section");
    block.className = "rayon-block";
    block.innerHTML = `<h3 class="rayon-titre">${esc(rayon)} <span class="n">${list.length}</span></h3>`;
    const ul = document.createElement("div");
    ul.className = "courses-list";
    for (const it of list) {
      const id = "c_" + btoa(unescape(encodeURIComponent(it.key))).replace(/=/g, "");
      const isChecked = checked.has(it.key);
      const qty = it.hasQty && it.qty ? `<span class="ing-qty">${fmtQty(it.qty)} ${esc(it.unit)}</span>` : "";
      const row = document.createElement("label");
      row.className = "course-item" + (isChecked ? " done" : "");
      row.innerHTML =
        `<input type="checkbox" id="${id}" ${isChecked ? "checked" : ""} />` +
        `<span class="ing-name">${esc(it.item)}</span>${qty}`;
      row.querySelector("input").addEventListener("change", (e) => {
        const set = getChecked();
        if (e.target.checked) set.add(it.key);
        else set.delete(it.key);
        saveChecked(set);
        row.classList.toggle("done", e.target.checked);
        refreshProgress();
      });
      ul.appendChild(row);
    }
    block.appendChild(ul);
    frag.appendChild(block);
  }

  if (missing.length) {
    const det = document.createElement("details");
    det.className = "courses-missing";
    const uniq = [...new Map(missing.map((r) => [r.id, r])).values()];
    det.innerHTML =
      `<summary>🧩 ${uniq.length} recette(s) à détailler (pas encore d'ingrédients)</summary>` +
      `<ul>${uniq.map((r) => `<li>${esc(r.titre)}</li>`).join("")}</ul>`;
    frag.appendChild(det);
  }

  root.replaceChildren(frag);
  refreshProgress();
}

function coursesToText() {
  const { items } = aggregateCourses();
  const byRayon = new Map();
  for (const it of items) {
    if (!byRayon.has(it.rayon)) byRayon.set(it.rayon, []);
    byRayon.get(it.rayon).push(it);
  }
  const lines = ["🛒 Liste de courses 365Food", ""];
  for (const rayon of COURSES_RAYONS) {
    const list = byRayon.get(rayon);
    if (!list) continue;
    lines.push(rayon.toUpperCase());
    list
      .sort((a, b) => a.item.localeCompare(b.item, "fr"))
      .forEach((it) => lines.push(`  - ${it.item}${it.hasQty && it.qty ? ` : ${fmtQty(it.qty)} ${it.unit}` : ""}`));
    lines.push("");
  }
  return lines.join("\n").trim();
}

$("#courses-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(coursesToText());
    flashBtn($("#courses-copy"), "Copié ✓");
  } catch (e) {
    flashBtn($("#courses-copy"), "Échec");
  }
});

$("#courses-reset").addEventListener("click", () => {
  saveChecked(new Set());
  renderCourses();
});

/* ---------- Démarrage ---------- */
// Démarre sur la saison actuelle pour coller au contexte belge.
state.saison = currentSeason();

// PWA : installation + service worker.
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const hint = $("#install-hint");
  hint.innerHTML = "";
  const btn = document.createElement("button");
  btn.textContent = "📲 Installer l'app";
  btn.onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    hint.innerHTML = "";
  };
  hint.appendChild(btn);
});

if ("serviceWorker" in navigator) {
  // Recharge automatiquement une fois quand une nouvelle version prend la main,
  // pour que les mises à jour s'appliquent sans vidage de cache manuel.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return; // pas de reload au tout premier install
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update().catch(() => {}); // vérifie une mise à jour à chaque ouverture
    }).catch(() => {});
  });
}

load();
