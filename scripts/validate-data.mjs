#!/usr/bin/env node
// Valide data/recipes.json et data/resto.json : références, énumérations,
// cohérence des ingrédients/macros. À lancer après toute édition des données.
// Usage : node scripts/validate-data.mjs
// Sort avec un code d'erreur ≠ 0 s'il y a au moins une erreur (les avertissements ne bloquent pas).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const recipes = JSON.parse(readFileSync(join(root, "data", "recipes.json"), "utf8"));
const resto = JSON.parse(readFileSync(join(root, "data", "resto.json"), "utf8"));

const SAISONS = new Set(["toute_annee", "printemps", "ete", "automne", "hiver"]);
const REPAS = new Set(["dejeuner", "diner", "souper", "sauce", "dessert", "snack"]);
// Doit rester aligné avec COURSES_RAYONS dans app.js.
const RAYONS = new Set([
  "Fruits & légumes",
  "Boucherie & volaille",
  "Poissonnerie",
  "Crémerie & œufs",
  "Boulangerie",
  "Épicerie",
  "Sauces & condiments",
  "Surgelés",
  "Autre",
]);

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ---------- recipes.json ---------- */
const catIds = new Set();
for (const c of recipes.categories) {
  if (catIds.has(c.id)) err(`catégorie dupliquée : ${c.id}`);
  catIds.add(c.id);
  for (const r of c.repas) if (!REPAS.has(r)) err(`catégorie ${c.id} : repas inconnu "${r}"`);
}

const catById = new Map(recipes.categories.map((c) => [c.id, c]));
const recipeIds = new Set();
const usedCats = new Set();
for (const r of recipes.recipes) {
  const id = r.id;
  if (recipeIds.has(id)) err(`recette dupliquée : ${id}`);
  recipeIds.add(id);
  if (!catIds.has(r.categorie)) err(`${id} : catégorie inconnue "${r.categorie}"`);
  usedCats.add(r.categorie);
  if (!Array.isArray(r.saisons) || r.saisons.length === 0) err(`${id} : saisons manquantes`);
  else for (const s of r.saisons) if (!SAISONS.has(s)) err(`${id} : saison inconnue "${s}"`);

  const hasIngr = Array.isArray(r.ingredients) && r.ingredients.length > 0;
  // Les sauces/condiments n'ont pas de découpage protéine/légume/féculent.
  const isSauce = catById.get(r.categorie)?.repas.includes("sauce");
  if (hasIngr) {
    if (!r.portions) warn(`${id} : recette détaillée sans champ "portions"`);
    for (const ing of r.ingredients) {
      if (!ing.item) err(`${id} : ingrédient sans "item"`);
      if (ing.rayon && !RAYONS.has(ing.rayon)) err(`${id} : rayon inconnu "${ing.rayon}" (${ing.item})`);
      if (typeof ing.qty !== "number" || !(ing.qty > 0)) warn(`${id} : quantité douteuse pour "${ing.item}" (${ing.qty})`);
    }
    if (!r.macros) warn(`${id} : ingrédients présents mais macros absentes`);
    if (!r.composantes && !isSauce) warn(`${id} : ingrédients présents mais composantes absentes`);
  }

  if (r.macros) {
    const { kcal, proteines, glucides, lipides } = r.macros;
    for (const [k, v] of Object.entries({ kcal, proteines, glucides, lipides })) {
      if (typeof v !== "number") err(`${id} : macro "${k}" manquante ou non numérique`);
    }
    if ([kcal, proteines, glucides, lipides].every((v) => typeof v === "number")) {
      const est = 4 * proteines + 4 * glucides + 9 * lipides;
      if (Math.abs(est - kcal) / kcal > 0.25)
        warn(`${id} : kcal incohérentes (annoncé ${kcal}, 4P+4G+9L ≈ ${Math.round(est)})`);
    }
  }
}
for (const c of recipes.categories) {
  if (!usedCats.has(c.id)) warn(`catégorie sans recette : ${c.id}`);
}

// Unités mixtes : un même produit acheté en « g » ici et en « pièce » là
// sort en libellé combiné dans la liste de courses — autant l'uniformiser.
const units = new Map();
for (const r of recipes.recipes) {
  if (!Array.isArray(r.ingredients)) continue;
  for (const ing of r.ingredients) {
    const key = `${(ing.item || "").toLowerCase()}|${ing.rayon || "Autre"}`;
    if (!units.has(key)) units.set(key, new Set());
    units.get(key).add(ing.unit || "");
  }
}
for (const [key, set] of units) {
  if (set.size > 1) warn(`unités mixtes pour "${key.split("|")[0]}" : ${[...set].join(", ")}`);
}

/* ---------- resto.json ---------- */
const enseigneIds = new Set();
for (const e of resto.enseignes) {
  if (enseigneIds.has(e.id)) err(`enseigne dupliquée : ${e.id}`);
  enseigneIds.add(e.id);
  for (const pickName of ["optimal", "alternative"]) {
    const p = e[pickName];
    if (!p) {
      err(`${e.id} : "${pickName}" manquant`);
      continue;
    }
    if (!p.nom || !p.pourquoi) err(`${e.id}.${pickName} : "nom" ou "pourquoi" manquant`);
    for (const k of ["kcal", "proteines", "glucides", "lipides"]) {
      if (typeof p.macros?.[k] !== "number") err(`${e.id}.${pickName} : macro "${k}" manquante`);
    }
  }
  if (!e.astuce) warn(`${e.id} : "astuce" manquante`);
}

/* ---------- rapport ---------- */
for (const w of warnings) console.warn(`⚠️  ${w}`);
for (const e of errors) console.error(`❌ ${e}`);
console.log(
  `\n${recipes.recipes.length} recettes, ${recipes.categories.length} catégories, ${resto.enseignes.length} enseignes — ` +
    `${errors.length} erreur(s), ${warnings.length} avertissement(s).`
);
if (errors.length) process.exit(1);
