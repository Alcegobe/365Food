# 🍔🥗 365Food

Petite **PWA** pour gérer mes repas sur l'année : manger sainement **sans avoir l'impression de se priver**. Du fast-food revisité healthy (burger sauce légère + frites à l'air fryer, kebab sauce blanche light, pizza maison, etc.), adapté à la **Belgique** et aux **saisons**.

## 🎯 Objectifs

- **Corps athlétique** : perte de gras + prise musculaire (entraînement kettlebell à côté).
- **Plaisir d'abord** : des plats sympas pour éviter de craquer sur des « crasses ».
- **Équilibre par repas** : minimum **1 protéine + 1 légume** (+ 1 féculent optionnel).
- **Courses malines** : recettes qui partagent des ingrédients (réutilisation, moins de gaspillage).
- **Saisons belges** : privilégier ce qui se trouve facilement selon la période.
- **On n'aime pas** : tofu, quinoa.

## 🍽️ Vocabulaire des repas (belge)

| Repas | Moment | Équivalent FR |
|-------|--------|---------------|
| **déjeuner** | matin | petit-déjeuner |
| **dîner** | midi | déjeuner |
| **souper** | soir | dîner |

## 📂 Contenu actuel

- **[`RECETTES.md`](./RECETTES.md)** — listing lisible (généré automatiquement). **C'est le fichier à parcourir.**
- **[`data/recipes.json`](./data/recipes.json)** — source de données (vérité unique) : **237 recettes, 30 catégories, toutes détaillées** (ingrédients, macros, étapes).
- **[`data/resto.json`](./data/resto.json)** — assistant « Manger dehors » : pour chaque enseigne (Burger King, kebab, sushi, italien…), 1 choix optimal + 1 alternative, macros estimées, astuce upgrade et piège à éviter. Zéro culpabilisation.
- **[`scripts/generate-listing.mjs`](./scripts/generate-listing.mjs)** — régénère `RECETTES.md` depuis le JSON.
- **[`scripts/validate-data.mjs`](./scripts/validate-data.mjs)** — valide les deux fichiers de données (références, saisons, rayons, cohérence des macros).
- **[`scripts/enrich-pilot.mjs`](./scripts/enrich-pilot.mjs)** — script d'amorçage des 36 recettes « pilotes » (composantes/ingrédients/macros codés en dur). Il **ignore** les recettes déjà enrichies ; `--force` les réécrit depuis ses constantes (écrase donc les corrections manuelles).

### App (PWA) — 4 onglets
- **🍳 Recettes** : recherche + filtres repas/saison sur les 237 recettes ; fiche détaillée au clic (ingrédients, macros, étapes).
- **📅 Semaine** : planning 7 jours généré depuis les recettes (variété des protéines, plats « plaisir » espacés, saison figée en début de semaine, persisté en localStorage).
- **🛒 Courses** : liste de courses par rayon dérivée du même planning, quantités ramenées à 1 personne, cases à cocher.
- **🍔 Dehors** : tu es au fast-food / resto → l'app te donne le meilleur compromis goût/objectif (menus France, valeurs estimées).

Catégories : déjeuners (avoine, œufs, laitages, salé), burgers, friterie/air fryer, kebab, **pizzas (8+ variantes)**, wok & nouilles, pokebowls, quiches, rôtis, cordons bleus, poissons, crevettes & fruits de mer, **plats belges traditionnels revisités**, salades/bowls meal-prep, pâtes, viandes, **sauces healthy catégorisées** (blanches, avocat, tomate, asiatiques, herbes, friterie), desserts (sablé, fruits, crémeux, chocolat) et snacks/petits creux.

## 🔧 Régénérer le listing / valider les données

```bash
node scripts/generate-listing.mjs   # régénère RECETTES.md
node scripts/validate-data.mjs      # valide recipes.json + resto.json
```

Modifier **uniquement** `data/recipes.json`, puis relancer ces commandes — `RECETTES.md` est généré.

## 🗺️ Suite (roadmap)

- [x] **Étape 1 — Listing des titres**
- [ ] Valider / ajuster la liste avec le propriétaire (ajouts, retraits)
- [x] Étape 2 — **détails par recette** : les 237 recettes ont ingrédients + macros + étapes (reste : temps de préparation par recette)
- [x] Étape 3 — **Plannings de la semaine** : onglet 📅 Semaine (7 jours, variété, saisons)
- [x] Étape 4 — **Listes de courses** auto-générées + mutualisation des ingrédients (onglet 🛒 Courses)
- [x] Étape 5 — **App PWA** : navigation, filtres, mode hors-ligne (service worker), installable sur mobile (reste : favoris)
- [ ] Étape 6 — Suivi nutritionnel adapté à l'objectif (recomposition corporelle)

## 📐 Schéma des données (`data/recipes.json`)

```jsonc
{
  "recipes": [
    {
      "id": "burger-boeuf-sauce-light",      // identifiant unique (slug)
      "titre": "Burger maison bœuf maigre…", // nom affiché
      "categorie": "burgers",                 // référence vers categories[].id
      "saisons": ["toute_annee"],             // toute_annee | printemps | ete | automne | hiver

      // Champs des recettes détaillées (les 237 recettes) :
      "portions": 2,                          // nombre de portions couvert par les quantités
      "composantes": { "proteine": "Bœuf haché maigre", "legume": "Salade, tomate", "feculent": "Pain complet" },
      "macros": { "kcal": 520, "proteines": 38, "glucides": 38, "lipides": 22 }, // PAR portion
      "ingredients": [
        { "item": "Bœuf haché 5%", "qty": 250, "unit": "g", "rayon": "Boucherie & volaille" }
      ],
      "etapes": ["Façonner les steaks…", "Cuire 3 min par face…"]
    }
  ]
}
```

Valeurs de `rayon` reconnues par l'app (toute autre valeur est signalée par `validate-data.mjs`) :
`Fruits & légumes`, `Boucherie & volaille`, `Poissonnerie`, `Crémerie & œufs`, `Boulangerie`, `Épicerie`, `Sauces & condiments`, `Surgelés`, `Autre`.
