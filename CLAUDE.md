# Brief — Application « Livre de recettes » (macros & points)

> Document de cadrage à donner à Claude Code pour démarrer le projet.
> Projet personnel, mais avec un rendu et une rigueur professionnels.

---

## 1. Contexte et objectif

Je veux une application web **HTML / CSS / JS, 100 % statique** (hébergeable sur GitHub Pages, sans serveur) qui remplace un livre de recettes papier.

L'idée : des recettes dans l'esprit des influenceurs « healthy plaisir » (type *Sauce ta diète* sur TikTok) : burgers, kebabs, pizzas, desserts… revisités pour **paraître gras et gourmands tout en étant légers et riches en protéines**. On mange « autant qu'on veut » sans impression de restriction.

L'application doit :

1. Calculer **mes besoins personnels** (kcal, protéines, lipides, glucides) à partir de mon profil, et les tenir à jour dans le temps.
2. Convertir ces besoins en un **budget de points** par jour et par semaine.
3. Proposer un **catalogue de recettes** (sauces, matin, midi, soir, et éventuellement desserts / snacks), chacune valant un nombre de points.
4. Me permettre de **composer mes journées** et de suivre ma consommation de points et de protéines.
5. Permettre d'**imprimer** proprement n'importe quelle recette ou sélection de recettes (fiches A4 / A5, export PDF via le navigateur).

Langue de l'interface : **français**. Unités métriques (g, ml, kcal).

---

## 2. Fonctionnalités

### 2.1 Profil utilisateur (première ouverture + modifiable)

- Date de naissance → **l'âge se calcule automatiquement** (jamais saisi en dur).
- Sexe (nécessaire à la formule), taille (cm), poids (kg).
- Niveau d'activité (sédentaire → très actif) et éventuellement jours de sport / semaine.
- Objectif : perte de poids / maintien / prise de muscle, avec un déficit ou surplus réglable (par défaut ±15 %).
- Fréquence de **rappel de pesée** (par défaut tous les 14 jours) : à l'échéance, l'app affiche une invite « Quel est ton poids aujourd'hui ? » ; l'historique des pesées est conservé et affiché sous forme de courbe simple.
- Les cibles se **recalculent automatiquement** après chaque nouvelle pesée ou changement de profil.

### 2.2 Calcul des besoins (voir formules §4)

- Métabolisme de base (Mifflin-St Jeor) → dépense journalière (facteur d'activité) → cible kcal selon l'objectif.
- Répartition en macros : protéines d'abord (g/kg de poids), lipides ensuite (g/kg), glucides = le reste.
- Affichage clair : « Aujourd'hui : X kcal · P Y g · L Z g · G W g · **N points** ».

### 2.3 Système de points

- Chaque recette a un nombre de points calculé **automatiquement** depuis ses macros (formule §4.4), jamais saisi à la main.
- Budget **quotidien** + budget **hebdomadaire** (7 × quotidien + ~10 % de « jokers » pour un resto / une soirée).
- Jauge du jour et de la semaine : points consommés / restants, protéines atteintes ou non.

### 2.4 Catalogue de recettes

- Catégories : **Sauces · Matin · Midi · Soir** (+ *Desserts & snacks* si activé).
- Principe des midis : **restes de la veille** (chaque dîner est prévu pour 2 portions par défaut, avec une note « le lendemain : réchauffage / version froide ») **ou** un chapitre « Midi express » d'alternatives en < 10 min.
- Filtres et recherche : catégorie, points max, temps de préparation, ingrédient, tags (haute protéine, sans cuisson, batch cooking, air fryer…).
- Fiche recette : titre accrocheur, photo (optionnelle), portions, temps, ingrédients pesés, étapes, macros par portion, points, astuce « pourquoi c'est léger », variantes.
- Ajustement du nombre de portions → quantités et macros recalculées.
- Possibilité d'**ajouter / éditer mes propres recettes** via un formulaire, avec calcul automatique des macros à partir d'une base d'ingrédients.

### 2.5 Planning

- Vue journée et vue semaine : glisser-déposer (ou sélection) de recettes dans les créneaux matin / midi / soir (+ snack).
- Bouton « Midi = restes d'hier soir » qui reprend automatiquement la portion 2 du dîner précédent.
- **Liste de courses** générée depuis la semaine planifiée (ingrédients agrégés par rayon).

### 2.6 Impression / export

- Feuille de style `@media print` dédiée : une recette = une belle fiche, format A4 (et option A5, 2 par page).
- « Imprimer la sélection » : plusieurs recettes, ou la semaine + liste de courses.
- Masquer à l'impression : navigation, boutons, jauges.
- Export / import de **toutes les données en JSON** (sauvegarde, changement d'appareil).

---

## 3. Données et stockage

- Aucune donnée personnelle ne quitte l'appareil : **localStorage** (ou IndexedDB) pour le profil, l'historique de poids, le planning et les recettes personnelles.
- Recettes « officielles » livrées dans un fichier `recipes.json` versionné dans le repo.
- Base d'ingrédients `ingredients.json` (valeurs pour 100 g : kcal, protéines, lipides, glucides, fibres, sel) — source de référence : **table Ciqual (ANSES)**, complétée par les produits courants du genre disponibles en Belgique (skyr, fromage frais light, wraps protéinés, fromage râpé allégé, etc.).

### 3.1 Modèle d'une recette (JSON)

```json
{
  "id": "burger-smash-light",
  "title": "Smash burger façon fast-food (light)",
  "category": "soir",
  "tags": ["haute-proteine", "batch", "restes-midi"],
  "servings": 2,
  "prepMin": 10,
  "cookMin": 12,
  "image": "img/burger-smash-light.jpg",
  "ingredients": [
    { "ref": "boeuf-hache-5", "qty": 250, "unit": "g", "label": "bœuf haché 5 % MG" },
    { "ref": "pain-burger-complet", "qty": 2, "unit": "pce" }
  ],
  "steps": ["…", "…"],
  "whyLight": "Bœuf 5 %, sauce au skyr à la place de la mayo…",
  "leftoverTip": "Le lendemain : steak réchauffé 1 min, pain toasté à part.",
  "variants": ["Version poulet : …"]
}
```

Les macros et les points d'une recette sont **calculés** (ingrédients × base d'ingrédients ÷ portions), pas stockés en dur, sauf pour un override manuel (`"nutritionOverride": {...}`).

### 3.2 Modèle du profil

```json
{
  "birthDate": "1990-01-01",
  "sex": "m",
  "heightCm": 180,
  "activity": 1.55,
  "goal": "loss",
  "goalAdjustPct": -15,
  "weighInEveryDays": 14,
  "weights": [{ "date": "2026-09-05", "kg": 80.0 }]
}
```

---

## 4. Formules

### 4.1 Âge
Calculé à chaque chargement depuis `birthDate` (années révolues).

### 4.2 Métabolisme de base — Mifflin-St Jeor
- Homme : `BMR = 10 × poids(kg) + 6,25 × taille(cm) − 5 × âge + 5`
- Femme : `BMR = 10 × poids(kg) + 6,25 × taille(cm) − 5 × âge − 161`

### 4.3 Dépense journalière et cible
- `TDEE = BMR × facteur d'activité` (sédentaire 1,2 · léger 1,375 · modéré 1,55 · actif 1,725 · très actif 1,9)
- `Cible kcal = TDEE × (1 + goalAdjustPct / 100)`, avec un plancher de sécurité (ne jamais descendre sous ~1 500 kcal pour un homme / ~1 200 pour une femme sans avertissement).
- Macros par défaut (modifiables dans les réglages) :
  - Protéines : **1,8 g/kg** de poids (2,0 en prise de muscle, 1,6 en maintien)
  - Lipides : **0,9 g/kg**
  - Glucides : `(kcal − 4×P − 9×L) / 4`
  - Fibres : indicatif 25–30 g/jour

### 4.4 Points
Système simple et transparent (le but est de récompenser les plats protéinés et rassasiants) :

```
points(recette / portion) = kcal / 50  −  protéines(g) / 10  +  bonus_malus
```
- Arrondi au demi-point, minimum 0.
- `bonus_malus` optionnel (réglable) : −0,5 si ≥ 5 g de fibres ; +0,5 si sucres ajoutés > 15 g.
- Budget quotidien = points de la cible kcal / protéines du jour, calculé avec la même formule.
- Budget hebdo = 7 × quotidien × 1,10 (jokers).

> Ces paramètres (facteurs, g/kg, coefficients de points) doivent être centralisés dans un fichier `config.js` pour être ajustés facilement.

---

## 5. Stack et contraintes techniques

- **Vanilla HTML / CSS / JS** (ES modules) ou un framework très léger si vraiment utile. Pas de backend. Doit tourner en ouvrant `index.html` et sur GitHub Pages.
- **Responsive** (usage principal : téléphone en cuisine, PC pour planifier). Mode sombre bienvenu.
- Rendu **pro et appétissant** : typographie soignée, cartes recettes avec photo, palette chaleureuse, hiérarchie claire ; éviter l'aspect « dashboard médical ».
- Accessibilité de base (contrastes, focus, labels).
- Pas d'analytics, pas d'appel réseau obligatoire (fonctionne hors ligne ; un `manifest.json` + service worker pour l'installer comme PWA est un plus).
- Tests unitaires pour les formules (§4) : ce sont les calculs qui portent tout le projet.

---

## 6. Structure de repo suggérée

```
/
├── index.html
├── css/
│   ├── app.css
│   └── print.css
├── js/
│   ├── config.js        # tous les paramètres ajustables
│   ├── nutrition.js     # BMR, TDEE, macros, points (+ tests)
│   ├── store.js         # localStorage, export/import JSON
│   ├── recipes.js       # chargement, filtres, calcul macros
│   ├── planner.js       # journée / semaine / liste de courses
│   └── ui/…
├── data/
│   ├── ingredients.json
│   └── recipes.json
├── img/
└── README.md
```

---

## 7. Feuille de route

1. **V0 — Socle** : profil, calcul des cibles, budget de points, stockage local, export/import. Tests des formules.
2. **V1 — Recettes** : base d'ingrédients, `recipes.json` avec 3 recettes de référence (fournies par moi) + gabarit de fiche, filtres, impression A4/A5.
3. **V2 — Planning** : journée / semaine, restes du midi, jauges, liste de courses.
4. **V3 — Contenu** : génération du catalogue complet (ordre de grandeur à confirmer : ~10 sauces, ~10 matins, ~15 midis express, ~30 soirs, desserts/snacks), rappel de pesée et courbe.
5. **V4 — Finitions** : PWA, mode sombre, ajout/édition de recettes perso, polish visuel.

---

## 8. Points encore à décider (à compléter avant V3)

- Contraintes alimentaires (allergies, aliments exclus, porc / poisson / végé).
- Desserts & snacks : oui / non.
- Temps max en cuisine le soir ; matériel disponible (air fryer, balance, blender…).
- Photos : les miennes (dossier `img/`) ou fiches sans photo avec un design typographique.
- Nombre de recettes visé par catégorie.

---

## 9. État d'avancement (à tenir à jour à chaque version)

| Version | État | Notes |
|---------|------|-------|
| **V0 — Socle** | ✅ livrée | profil, cibles, budget de points, localStorage, export/import JSON, tests des formules (`npm test`) |
| **V1 — Recettes** | ✅ livrée | `data/ingredients.json`, `data/recipes.json` (3 recettes de référence rédigées par Claude : sauce blanche kebab, pancakes protéinés, smash burger), catalogue + filtres, fiche avec portions ajustables, impression A4/A5, routes `#/…` |
| V2 — Planning | ⏳ à faire | |
| V3 — Contenu | ⏳ à faire | répondre d'abord au §8 |
| V4 — Finitions | ⏳ à faire | |

Règles de travail pour les prochaines sessions :

- Avancer **une version à la fois**, dans l'ordre de la feuille de route (§7).
- Toute formule (§4) vit dans `js/nutrition.js`, ses paramètres dans `js/config.js`, et a un test dans `tests/`.
- Lancer `npm test` avant chaque commit (Node ≥ 20, aucune dépendance).
- Interface en français, unités métriques, aucune donnée ne quitte l'appareil.
- Interface sobre : pas de texte explicatif superflu (rappels de confidentialité, conseils de sauvegarde, aides de champ évidentes).
