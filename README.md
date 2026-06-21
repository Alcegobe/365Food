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

> Étape 1 (faite) : **listing complet des recettes — titres uniquement**, catégorisés et marqués par saison.

- **[`RECETTES.md`](./RECETTES.md)** — listing lisible (généré automatiquement). **C'est le fichier à parcourir.**
- **[`data/recipes.json`](./data/recipes.json)** — source de données (vérité unique) : 237 recettes, 30 catégories.
- **[`scripts/generate-listing.mjs`](./scripts/generate-listing.mjs)** — régénère `RECETTES.md` depuis le JSON.
- **[`data/resto.json`](./data/resto.json)** — assistant « Manger dehors » : pour chaque enseigne (Burger King, kebab, sushi, italien…), 1 choix optimal + 1 alternative, macros estimées, astuce upgrade et piège à éviter. Zéro culpabilisation.

### App (PWA) — 2 onglets
- **🍳 Recettes maison** : recherche + filtres repas/saison sur les 237 recettes.
- **🍔 Manger dehors** : tu es au fast-food / resto → l'app te donne le meilleur compromis goût/objectif (menus France, valeurs estimées).

Catégories : déjeuners (avoine, œufs, laitages, salé), burgers, friterie/air fryer, kebab, **pizzas (8+ variantes)**, wok & nouilles, pokebowls, quiches, rôtis, cordons bleus, poissons, crevettes & fruits de mer, **plats belges traditionnels revisités**, salades/bowls meal-prep, pâtes, viandes, **sauces healthy catégorisées** (blanches, avocat, tomate, asiatiques, herbes, friterie), desserts (sablé, fruits, crémeux, chocolat) et snacks/petits creux.

## 🔧 Régénérer le listing

```bash
node scripts/generate-listing.mjs
```

Modifier **uniquement** `data/recipes.json`, puis relancer la commande — `RECETTES.md` est généré.

## 🗺️ Suite (roadmap)

- [ ] **Étape 1 — Listing des titres** ✅
- [ ] Valider / ajuster la liste avec le propriétaire (ajouts, retraits)
- [ ] Étape 2 — Ajouter les **détails par recette** : ingrédients, étapes, temps, macros (protéines/glucides/lipides/kcal), composantes (protéine/légume/féculent)
- [ ] Étape 3 — **Plannings de la semaine** : 7 recettes/semaine × 52 semaines, en suivant les saisons
- [ ] Étape 4 — **Listes de courses** auto-générées + mutualisation des ingrédients
- [ ] Étape 5 — **App PWA** : navigation, filtres (repas, catégorie, saison), favoris, mode hors-ligne (service worker), installable sur mobile
- [ ] Étape 6 — Suivi nutritionnel adapté à l'objectif (recomposition corporelle)

## 📐 Schéma des données (`data/recipes.json`)

```jsonc
{
  "recipes": [
    {
      "id": "burger-boeuf-sauce-light",      // identifiant unique (slug)
      "titre": "Burger maison bœuf maigre…", // nom affiché
      "categorie": "burgers",                 // référence vers categories[].id
      "saisons": ["toute_annee"]              // toute_annee | printemps | ete | automne | hiver
      // à venir : ingredients, etapes, macros, composantes{proteine,legume,feculent}…
    }
  ]
}
```
