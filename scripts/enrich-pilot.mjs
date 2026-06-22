#!/usr/bin/env node
// Enrichit data/recipes.json : composantes + ingredients + macros (par portion)
// pour les recettes "pilotes" (vagues 1 & 2). Idempotent.
// Usage : node scripts/enrich-pilot.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "data", "recipes.json");
const data = JSON.parse(readFileSync(path, "utf8"));

const FL = "Fruits & légumes";
const BV = "Boucherie & volaille";
const PO = "Poissonnerie";
const CR = "Crémerie & œufs";
const EP = "Épicerie";
const BO = "Boulangerie";
const SC = "Sauces & condiments";
const SU = "Surgelés";

const i = (item, qty, unit, rayon) => ({ item, qty, unit, rayon });
const m = (kcal, proteines, glucides, lipides) => ({ kcal, proteines, glucides, lipides });

// Quantités pour 2 portions ; macros estimées PAR portion.
const PILOT = {
  // ===== Vague 1 — Plats =====
  "burger-boeuf-sauce-light": {
    composantes: { proteine: "Bœuf haché maigre", legume: "Salade, tomate, oignon", feculent: "Pain à burger complet" },
    macros: m(520, 38, 38, 22),
    ingredients: [
      i("Bœuf haché 5%", 250, "g", BV), i("Pain à burger complet", 2, "pièce", BO),
      i("Tomate", 1, "pièce", FL), i("Oignon rouge", 0.5, "pièce", FL),
      i("Salade (feuilles)", 4, "feuille", FL), i("Cheddar", 2, "tranche", CR),
      i("Yaourt grec 0%", 2, "c.à.s", CR), i("Ketchup", 1, "c.à.s", SC),
    ],
  },
  "cheeseburger-frites-airfryer": {
    composantes: { proteine: "Bœuf haché maigre", legume: "Salade, tomate", feculent: "Pain + pommes de terre" },
    macros: m(620, 34, 55, 28),
    ingredients: [
      i("Bœuf haché 5%", 250, "g", BV), i("Pain à burger complet", 2, "pièce", BO),
      i("Cheddar", 2, "tranche", CR), i("Pommes de terre", 400, "g", FL),
      i("Huile d'olive", 1, "c.à.s", EP), i("Cornichon", 4, "pièce", SC),
    ],
  },
  "kebab-poulet-sauce-blanche": {
    composantes: { proteine: "Poulet mariné", legume: "Crudités", feculent: "Pain pita complet" },
    macros: m(560, 45, 50, 18),
    ingredients: [
      i("Filet de poulet", 300, "g", BV), i("Pain pita complet", 2, "pièce", BO),
      i("Tomate", 1, "pièce", FL), i("Oignon", 0.5, "pièce", FL),
      i("Salade (feuilles)", 4, "feuille", FL), i("Yaourt grec 0%", 3, "c.à.s", CR),
      i("Ail", 1, "gousse", FL), i("Épices kebab (cumin, paprika)", 1, "c.à.c", EP),
    ],
  },
  "pizza-margherita": {
    composantes: { proteine: "Mozzarella", legume: "Tomate, basilic", feculent: "Pâte à pizza" },
    macros: m(600, 26, 70, 22),
    ingredients: [
      i("Pâte à pizza", 1, "pièce", BO), i("Sauce tomate", 100, "g", SC),
      i("Mozzarella", 125, "g", CR), i("Basilic frais", 1, "pincée", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "wok-poulet-legumes": {
    composantes: { proteine: "Poulet", legume: "Légumes wok", feculent: "Riz" },
    macros: m(480, 40, 45, 14),
    ingredients: [
      i("Filet de poulet", 300, "g", BV), i("Mélange de légumes wok", 400, "g", FL),
      i("Riz", 150, "g", EP), i("Sauce soja", 2, "c.à.s", SC),
      i("Gingembre", 1, "c.à.c", FL), i("Ail", 1, "gousse", FL), i("Huile de sésame", 1, "c.à.c", EP),
    ],
  },
  "spaghetti-bolognaise": {
    composantes: { proteine: "Bœuf haché maigre", legume: "Tomate, carotte, oignon", feculent: "Spaghetti" },
    macros: m(560, 34, 68, 14),
    ingredients: [
      i("Bœuf haché 5%", 250, "g", BV), i("Spaghetti", 180, "g", EP),
      i("Tomates concassées", 400, "g", EP), i("Oignon", 1, "pièce", FL),
      i("Carotte", 1, "pièce", FL), i("Ail", 1, "gousse", FL), i("Parmesan", 20, "g", CR),
    ],
  },
  "saumon-teriyaki-brocoli": {
    composantes: { proteine: "Saumon", legume: "Brocoli", feculent: "Riz" },
    macros: m(520, 40, 35, 22),
    ingredients: [
      i("Pavé de saumon", 2, "pièce", PO), i("Brocoli", 400, "g", FL),
      i("Riz", 150, "g", EP), i("Sauce soja", 2, "c.à.s", SC),
      i("Miel", 1, "c.à.c", EP), i("Graines de sésame", 1, "c.à.c", EP),
    ],
  },
  "cabillaud-ecrase-pdt": {
    composantes: { proteine: "Cabillaud", legume: "Persil, citron", feculent: "Pommes de terre" },
    macros: m(430, 38, 40, 12),
    ingredients: [
      i("Dos de cabillaud", 2, "pièce", PO), i("Pommes de terre", 400, "g", FL),
      i("Lait demi-écrémé", 50, "ml", CR), i("Citron", 0.5, "pièce", FL),
      i("Persil", 1, "pincée", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "poulet-roti-citron-thym": {
    composantes: { proteine: "Poulet", legume: "Ail, thym, citron", feculent: "Pommes de terre" },
    macros: m(520, 42, 35, 20),
    ingredients: [
      i("Cuisses de poulet", 400, "g", BV), i("Citron", 1, "pièce", FL),
      i("Thym", 1, "pincée", FL), i("Ail", 2, "gousse", FL),
      i("Pommes de terre", 400, "g", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "chili-con-carne-riz": {
    composantes: { proteine: "Bœuf haché + haricots", legume: "Poivron, oignon, tomate", feculent: "Riz" },
    macros: m(560, 38, 62, 14),
    ingredients: [
      i("Bœuf haché 5%", 250, "g", BV), i("Haricots rouges", 240, "g", EP),
      i("Tomates concassées", 400, "g", EP), i("Oignon", 1, "pièce", FL),
      i("Poivron", 1, "pièce", FL), i("Riz", 150, "g", EP), i("Cumin & paprika", 1, "c.à.c", EP),
    ],
  },
  "pokebowl-saumon": {
    composantes: { proteine: "Saumon cru", legume: "Avocat, concombre, edamame", feculent: "Riz à sushi" },
    macros: m(560, 34, 60, 20),
    ingredients: [
      i("Saumon frais (qualité sashimi)", 200, "g", PO), i("Riz à sushi", 150, "g", EP),
      i("Avocat", 1, "pièce", FL), i("Concombre", 0.5, "pièce", FL),
      i("Edamame", 100, "g", SU), i("Sauce soja", 2, "c.à.s", SC), i("Graines de sésame", 1, "c.à.c", EP),
    ],
  },
  "cordon-bleu-poulet-airfryer": {
    composantes: { proteine: "Poulet, jambon", legume: "—", feculent: "Chapelure" },
    macros: m(540, 48, 28, 26),
    ingredients: [
      i("Escalope de poulet", 2, "pièce", BV), i("Jambon", 2, "tranche", BV),
      i("Emmental", 2, "tranche", CR), i("Chapelure (panko)", 60, "g", EP),
      i("Œuf", 1, "pièce", CR), i("Farine", 30, "g", EP),
    ],
  },
  "crevettes-ail-persil": {
    composantes: { proteine: "Crevettes", legume: "Ail, persil, citron", feculent: "Riz" },
    macros: m(420, 34, 42, 10),
    ingredients: [
      i("Crevettes décortiquées", 300, "g", PO), i("Riz", 150, "g", EP),
      i("Ail", 2, "gousse", FL), i("Persil", 1, "pincée", FL),
      i("Citron", 0.5, "pièce", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "riz-saute-poulet-legumes": {
    composantes: { proteine: "Poulet, œuf", legume: "Légumes", feculent: "Riz" },
    macros: m(520, 36, 60, 12),
    ingredients: [
      i("Filet de poulet", 250, "g", BV), i("Riz", 150, "g", EP),
      i("Mélange de légumes", 300, "g", FL), i("Œuf", 1, "pièce", CR),
      i("Sauce soja", 2, "c.à.s", SC), i("Ail", 1, "gousse", FL),
    ],
  },
  "steak-hache-haricots-verts": {
    composantes: { proteine: "Bœuf haché", legume: "Haricots verts", feculent: "Pommes de terre" },
    macros: m(430, 40, 22, 20),
    ingredients: [
      i("Steak haché 5%", 2, "pièce", BV), i("Haricots verts", 300, "g", FL),
      i("Pommes de terre", 300, "g", FL), i("Ail", 1, "gousse", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "nouilles-sautees-poulet": {
    composantes: { proteine: "Poulet", legume: "Légumes wok", feculent: "Nouilles" },
    macros: m(540, 38, 58, 14),
    ingredients: [
      i("Filet de poulet", 250, "g", BV), i("Nouilles chinoises", 180, "g", EP),
      i("Mélange de légumes wok", 300, "g", FL), i("Sauce soja", 2, "c.à.s", SC),
      i("Gingembre", 1, "c.à.c", FL), i("Ail", 1, "gousse", FL),
    ],
  },
  // ===== Vague 1 — Déjeuners =====
  "porridge-banane-cannelle": {
    composantes: { proteine: "Lait (+ whey)", legume: "—", feculent: "Flocons d'avoine" },
    macros: m(380, 22, 55, 8),
    ingredients: [
      i("Flocons d'avoine", 80, "g", EP), i("Lait demi-écrémé", 250, "ml", CR),
      i("Banane", 1, "pièce", FL), i("Cannelle", 1, "pincée", EP), i("Whey vanille (option)", 1, "c.à.s", EP),
    ],
  },
  "oeufs-plat-avocat-toast": {
    composantes: { proteine: "Œufs", legume: "Avocat", feculent: "Pain complet" },
    macros: m(420, 22, 26, 26),
    ingredients: [
      i("Œuf", 4, "pièce", CR), i("Pain complet", 2, "tranche", BO),
      i("Avocat", 1, "pièce", FL), i("Huile d'olive", 1, "c.à.c", EP),
    ],
  },
  "omelette-jambon-champignons": {
    composantes: { proteine: "Œufs, jambon", legume: "Champignons", feculent: "—" },
    macros: m(320, 28, 6, 20),
    ingredients: [
      i("Œuf", 4, "pièce", CR), i("Jambon", 2, "tranche", BV),
      i("Champignons", 100, "g", FL), i("Emmental", 20, "g", CR),
    ],
  },
  "bowl-skyr-granola": {
    composantes: { proteine: "Skyr", legume: "Fruits rouges", feculent: "Granola" },
    macros: m(360, 28, 45, 8),
    ingredients: [
      i("Skyr", 300, "g", CR), i("Granola", 50, "g", EP),
      i("Fruits rouges", 100, "g", FL), i("Miel", 1, "c.à.c", EP),
    ],
  },
  "pancakes-proteines-avoine": {
    composantes: { proteine: "Œufs, whey", legume: "—", feculent: "Flocons d'avoine" },
    macros: m(380, 28, 42, 10),
    ingredients: [
      i("Flocons d'avoine", 60, "g", EP), i("Œuf", 2, "pièce", CR),
      i("Banane", 1, "pièce", FL), i("Whey", 1, "dose", EP), i("Lait demi-écrémé", 50, "ml", CR),
    ],
  },
  "oeufs-brouilles-cottage": {
    composantes: { proteine: "Œufs, cottage cheese", legume: "Ciboulette", feculent: "Pain complet" },
    macros: m(330, 30, 18, 16),
    ingredients: [
      i("Œuf", 4, "pièce", CR), i("Cottage cheese", 100, "g", CR),
      i("Ciboulette", 1, "pincée", FL), i("Pain complet", 2, "tranche", BO),
    ],
  },
  "overnight-oats-cacahuete-cacao": {
    composantes: { proteine: "Lait, yaourt grec", legume: "—", feculent: "Flocons d'avoine" },
    macros: m(420, 24, 48, 14),
    ingredients: [
      i("Flocons d'avoine", 80, "g", EP), i("Lait demi-écrémé", 200, "ml", CR),
      i("Beurre de cacahuète", 1, "c.à.s", EP), i("Cacao maigre", 1, "c.à.c", EP), i("Yaourt grec 0%", 2, "c.à.s", CR),
    ],
  },
  "egg-muffins-jambon": {
    composantes: { proteine: "Œufs, jambon", legume: "Poivron", feculent: "—" },
    macros: m(260, 24, 6, 16),
    ingredients: [
      i("Œuf", 4, "pièce", CR), i("Jambon", 2, "tranche", BV),
      i("Poivron", 0.5, "pièce", FL), i("Emmental", 20, "g", CR),
    ],
  },

  // ===== Vague 2 — Plats =====
  "pizza-reine": {
    composantes: { proteine: "Jambon", legume: "Champignons", feculent: "Pâte à pizza" },
    macros: m(600, 30, 68, 20),
    ingredients: [
      i("Pâte à pizza", 1, "pièce", BO), i("Sauce tomate", 100, "g", SC),
      i("Mozzarella", 125, "g", CR), i("Jambon", 2, "tranche", BV),
      i("Champignons", 100, "g", FL), i("Origan", 1, "pincée", EP),
    ],
  },
  "pizza-poulet-pesto": {
    composantes: { proteine: "Poulet", legume: "Roquette", feculent: "Pâte à pizza" },
    macros: m(620, 36, 62, 22),
    ingredients: [
      i("Pâte à pizza", 1, "pièce", BO), i("Pesto", 2, "c.à.s", SC),
      i("Mozzarella", 100, "g", CR), i("Filet de poulet", 150, "g", BV), i("Roquette", 1, "poignée", FL),
    ],
  },
  "lasagnes-light-legumes": {
    composantes: { proteine: "Bœuf haché", legume: "Courgette, tomate", feculent: "Pâtes à lasagne" },
    macros: m(560, 38, 50, 20),
    ingredients: [
      i("Bœuf haché 5%", 250, "g", BV), i("Pâtes à lasagne", 6, "feuille", EP),
      i("Tomates concassées", 400, "g", EP), i("Courgette", 1, "pièce", FL),
      i("Oignon", 1, "pièce", FL), i("Lait demi-écrémé", 200, "ml", CR), i("Parmesan", 30, "g", CR),
    ],
  },
  "carbonara-light": {
    composantes: { proteine: "Œufs, dinde fumée", legume: "—", feculent: "Spaghetti" },
    macros: m(560, 34, 62, 18),
    ingredients: [
      i("Spaghetti", 180, "g", EP), i("Œuf", 3, "pièce", CR),
      i("Allumettes de dinde fumée", 120, "g", BV), i("Parmesan", 30, "g", CR), i("Ail", 1, "gousse", FL),
    ],
  },
  "saumon-papillote": {
    composantes: { proteine: "Saumon", legume: "Courgette, tomate", feculent: "—" },
    macros: m(420, 38, 8, 26),
    ingredients: [
      i("Pavé de saumon", 2, "pièce", PO), i("Courgette", 1, "pièce", FL),
      i("Tomate cerise", 100, "g", FL), i("Citron", 0.5, "pièce", FL),
      i("Aneth", 1, "pincée", FL), i("Huile d'olive", 1, "c.à.s", EP),
    ],
  },
  "fish-and-chips-healthy": {
    composantes: { proteine: "Cabillaud", legume: "Petits pois", feculent: "Pommes de terre" },
    macros: m(520, 40, 50, 14),
    ingredients: [
      i("Dos de cabillaud", 2, "pièce", PO), i("Chapelure (panko)", 60, "g", EP),
      i("Œuf", 1, "pièce", CR), i("Pommes de terre", 400, "g", FL),
      i("Petits pois", 150, "g", SU), i("Citron", 0.5, "pièce", FL),
    ],
  },
  "chicons-gratin-jambon": {
    composantes: { proteine: "Jambon", legume: "Chicons", feculent: "—" },
    macros: m(380, 34, 16, 20),
    ingredients: [
      i("Chicons", 4, "pièce", FL), i("Jambon", 4, "tranche", BV),
      i("Emmental râpé", 60, "g", CR), i("Lait demi-écrémé", 250, "ml", CR), i("Muscade", 1, "pincée", EP),
    ],
  },
  "salade-cesar-poulet": {
    composantes: { proteine: "Poulet", legume: "Laitue romaine", feculent: "Croûtons" },
    macros: m(420, 42, 20, 18),
    ingredients: [
      i("Filet de poulet", 300, "g", BV), i("Laitue romaine", 1, "pièce", FL),
      i("Parmesan", 30, "g", CR), i("Croûtons", 40, "g", BO),
      i("Yaourt grec 0%", 3, "c.à.s", CR), i("Ail", 1, "gousse", FL), i("Moutarde", 1, "c.à.c", SC),
    ],
  },
  "pokebowl-poulet-teriyaki": {
    composantes: { proteine: "Poulet", legume: "Edamame, carotte, avocat", feculent: "Riz" },
    macros: m(600, 42, 62, 16),
    ingredients: [
      i("Filet de poulet", 300, "g", BV), i("Riz", 150, "g", EP),
      i("Edamame", 100, "g", SU), i("Carotte", 1, "pièce", FL),
      i("Avocat", 0.5, "pièce", FL), i("Sauce teriyaki", 2, "c.à.s", SC), i("Graines de sésame", 1, "c.à.c", EP),
    ],
  },
  "durum-poulet-yaourt-ail": {
    composantes: { proteine: "Poulet", legume: "Crudités", feculent: "Galette à durum" },
    macros: m(560, 44, 52, 16),
    ingredients: [
      i("Filet de poulet", 300, "g", BV), i("Galette à durum", 2, "pièce", BO),
      i("Tomate", 1, "pièce", FL), i("Salade (feuilles)", 4, "feuille", FL),
      i("Oignon", 0.5, "pièce", FL), i("Yaourt grec 0%", 3, "c.à.s", CR), i("Ail", 1, "gousse", FL),
    ],
  },
  // ===== Vague 2 — Déjeuners =====
  "shakshuka-legere": {
    composantes: { proteine: "Œufs", legume: "Poivron, tomate, oignon", feculent: "—" },
    macros: m(280, 20, 18, 14),
    ingredients: [
      i("Œuf", 4, "pièce", CR), i("Tomates concassées", 400, "g", EP),
      i("Poivron", 1, "pièce", FL), i("Oignon", 1, "pièce", FL),
      i("Ail", 1, "gousse", FL), i("Cumin & paprika", 1, "c.à.c", EP),
    ],
  },
  "fromage-blanc-miel-noix": {
    composantes: { proteine: "Fromage blanc", legume: "—", feculent: "—" },
    macros: m(240, 26, 18, 8),
    ingredients: [
      i("Fromage blanc 0%", 300, "g", CR), i("Miel", 1, "c.à.s", EP), i("Noix", 30, "g", EP),
    ],
  },
};

let n = 0;
const byId = new Map(data.recipes.map((r) => [r.id, r]));
for (const [id, extra] of Object.entries(PILOT)) {
  const r = byId.get(id);
  if (!r) {
    console.warn("⚠️  id introuvable:", id);
    continue;
  }
  r.composantes = extra.composantes;
  r.ingredients = extra.ingredients;
  if (extra.macros) r.macros = extra.macros;
  n++;
}

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Enrichi ${n} recettes (composantes + ingredients + macros).`);
