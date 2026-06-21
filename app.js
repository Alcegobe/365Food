// 365Food — PWA statique. Lit data/recipes.json et affiche / filtre les recettes.

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

const state = { repas: "all", saison: "toutes", query: "" };
let DATA = null;
let CAT_BY_ID = new Map();

const $ = (sel) => document.querySelector(sel);
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function currentSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "printemps";
  if (m >= 6 && m <= 8) return "ete";
  if (m >= 9 && m <= 11) return "automne";
  return "hiver";
}

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
  if (!state.query) return text;
  const q = norm(state.query);
  const n = norm(text);
  const i = n.indexOf(q);
  if (i < 0) return text;
  return (
    text.slice(0, i) + "<mark>" + text.slice(i, i + state.query.length) + "</mark>" + text.slice(i + state.query.length)
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
    block.innerHTML = `<h2 class="cat-title">${cat.label} <span class="n">${items.length}</span></h2>`;

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
