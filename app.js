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
  $("#view-resto").hidden = view !== "resto";
  if (view === "resto" && RESTO === null) loadResto();
  if (view === "semaine") renderSemaine();
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
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        `<div class="card-title">${highlight(r.titre)}</div>` +
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

function poolFor(catSet, seasonalOnly) {
  const cur = currentSeason();
  return DATA.recipes.filter(
    (r) => catSet.has(r.categorie) && (!seasonalOnly || r.saisons.includes("toute_annee") || r.saisons.includes(cur))
  );
}

function buildWeek(salt, seasonalOnly) {
  const dejCats = new Set(DATA.categories.filter((c) => c.repas.includes("dejeuner")).map((c) => c.id));
  const mainCats = new Set(
    DATA.categories.filter((c) => c.repas.includes("diner") || c.repas.includes("souper")).map((c) => c.id)
  );
  const rng = mulberry32((isoWeekKey() * 131 + salt * 977) >>> 0);
  const dej = shuffle(poolFor(dejCats, seasonalOnly), rng);
  const mains = shuffle(poolFor(mainCats, seasonalOnly), rng);
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push({
      dejeuner: dej.length ? dej[i % dej.length] : null,
      diner: mains.length ? mains[(i * 2) % mains.length] : null,
      souper: mains.length ? mains[(i * 2 + 1) % mains.length] : null,
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
  if (!s || s.week !== wk) s = { week: wk, salt: 0, seasonal: true };
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

function renderSemaine() {
  const root = $("#semaine");
  if (!DATA) {
    pendingSemaine = true;
    root.innerHTML = `<p class="loading">Chargement…</p>`;
    return;
  }
  pendingSemaine = false;

  const s = getSemaineState();
  $("#semaine-seasonal").checked = s.seasonal;

  const mon = mondayOf();
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  $("#semaine-info").innerHTML =
    `<strong>Semaine du ${dm(mon)} au ${dm(sun)}</strong>` +
    `<span class="semaine-sub">${s.seasonal ? "🇧🇪 de saison" : "toutes saisons"} · 7 jours</span>`;

  SEMAINE_DAYS = buildWeek(s.salt, s.seasonal);

  const frag = document.createDocumentFragment();
  SEMAINE_DAYS.forEach((day, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    const line = (ico, label, r) =>
      `<div class="repas-line"><span class="repas-ico">${ico}</span>` +
      `<span class="repas-txt"><span class="repas-label">${label}</span>${r ? esc(r.titre) : "—"}</span></div>`;
    const sec = document.createElement("section");
    sec.className = "jour";
    sec.innerHTML =
      `<h3 class="jour-titre">${JOURS[i]} <span class="jour-date">${dm(d)}</span></h3>` +
      line("🍳", "Déjeuner", day.dejeuner) +
      line("🍽️", "Dîner", day.diner) +
      line("🌙", "Souper", day.souper);
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

$("#semaine-copy").addEventListener("click", async () => {
  const txt = semaineToText();
  const btn = $("#semaine-copy");
  try {
    await navigator.clipboard.writeText(txt);
    btn.textContent = "✅ Copié !";
  } catch (e) {
    btn.textContent = "⚠️ Copie impossible";
  }
  setTimeout(() => (btn.textContent = "📋 Copier"), 1800);
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
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {})
  );
}

load();
