#!/usr/bin/env node
// Génère RECETTES.md (listing lisible) à partir de data/recipes.json.
// Usage : node scripts/generate-listing.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "recipes.json"), "utf8"));

const saisonLabel = {
  toute_annee: "🗓️ toute l'année",
  printemps: "🌱 printemps",
  ete: "☀️ été",
  automne: "🍂 automne",
  hiver: "❄️ hiver",
};

const fmtSaisons = (s) => s.map((x) => saisonLabel[x] ?? x).join(", ");

const lines = [];
lines.push(`# 🍔🥗 ${data.meta.nom} — Listing des recettes`);
lines.push("");
lines.push(`> ${data.meta.description}`);
lines.push("");
lines.push("**Principes :**");
for (const p of data.meta.principes) lines.push(`- ${p}`);
lines.push("");
lines.push("**Repas (vocabulaire belge) :**");
for (const [k, v] of Object.entries(data.meta.repas)) lines.push(`- **${k}** — ${v}`);
lines.push("");

const total = data.recipes.length;
lines.push(`**Total : ${total} recettes** réparties en ${data.categories.length} catégories.`);
lines.push("");
lines.push("> ⚠️ Pour l'instant : titres uniquement. Les ingrédients, étapes, macros et listes de courses viendront ensuite.");
lines.push("");
lines.push("---");
lines.push("");

const byCat = new Map();
for (const r of data.recipes) {
  if (!byCat.has(r.categorie)) byCat.set(r.categorie, []);
  byCat.get(r.categorie).push(r);
}

for (const cat of data.categories) {
  const items = byCat.get(cat.id) ?? [];
  if (items.length === 0) continue;
  lines.push(`## ${cat.label}  _(${items.length})_`);
  lines.push("");
  for (const r of items) {
    const saisonal = r.saisons.includes("toute_annee") ? "" : ` — _${fmtSaisons(r.saisons)}_`;
    lines.push(`- ${r.titre}${saisonal}`);
  }
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push("## 🇧🇪 Repère des saisons en Belgique");
lines.push("");
for (const [saison, produits] of Object.entries(data.saisons_belgique)) {
  if (saison === "note") continue;
  lines.push(`- **${saison}** : ${produits.join(", ")}`);
}
lines.push("");
lines.push(`> ${data.saisons_belgique.note}`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("_Fichier généré automatiquement depuis `data/recipes.json` via `scripts/generate-listing.mjs`. Ne pas éditer à la main._");
lines.push("");

writeFileSync(join(root, "RECETTES.md"), lines.join("\n"));
console.log(`RECETTES.md généré : ${total} recettes, ${data.categories.length} catégories.`);
