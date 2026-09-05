# 365Food — Livre de recettes « healthy plaisir »

Application web **100 % statique** (HTML / CSS / JS en modules ES, sans serveur ni dépendance) qui remplace un livre de recettes papier : besoins personnels, budget de **points**, recettes gourmandes mais légères et riches en protéines, planning et impression.

Le cahier des charges complet est dans [`CLAUDE.md`](./CLAUDE.md) (formules §4, feuille de route §7, état d'avancement §9).

## État : V1 — Recettes ✅

- **V0 — Socle** : profil (âge calculé, sexe, taille, poids, activité, objectif, réglages g/kg), cibles du jour (Mifflin-St Jeor → dépense → cible avec plancher → macros), budget de points quotidien et hebdomadaire, pesées, stockage local, export / import JSON.
- **V1 — Recettes** : base d'ingrédients (`data/ingredients.json`, valeurs pour 100 g), trois recettes de référence (`data/recipes.json`), macros et points calculés automatiquement, catalogue avec recherche et filtres (catégorie, points max, temps max, tags), fiche recette avec portions ajustables, impression A4 ou A5.
- **Tests** des formules, du stockage, du catalogue et de la cohérence des fichiers de données (`npm test`, aucune dépendance).

Prochaine étape : **V2 — Planning** (journée / semaine, restes du midi, jauges, liste de courses).

## Lancer l'application

Les modules ES sont bloqués par Chrome/Edge lorsqu'on ouvre `index.html` directement en `file://` (Firefox l'accepte). Il suffit d'un petit serveur statique :

```bash
npm start                    # python3 -m http.server 8080
# ou : npx serve .
```

puis ouvrir <http://localhost:8080>. En production, le dépôt est publié tel quel sur **GitHub Pages** (workflow `.github/workflows/ci.yml`, déploiement depuis la branche par défaut).

## Tests

```bash
npm test
```

Node ≥ 20 (test runner intégré). Les tests couvrent chaque formule du brief §4 avec le profil de référence (homme, 36 ans, 180 cm, 80 kg, activité modérée, −15 % → 2 306 kcal · P 144 g · L 72 g · G 271 g · 31,5 points / jour · 242,5 points / semaine), les cas limites (plancher kcal, glucides tronqués, arrondi au demi-point, minimum 0, bonus fibres, malus sucres), la validation du profil, les pesées, les migrations de schéma, l'aller-retour export / import, le calcul des macros et des points d'une recette, l'ajustement des portions, les filtres, le routage, et la cohérence de `data/recipes.json` avec `data/ingredients.json`.

## Structure

```
/
├── index.html
├── sw.js                  # désinstalle le service worker de l'ancienne app (un vrai arrivera en V4)
├── css/
│   ├── app.css            # écran (dégradé menthe / gris, cartes, mode sombre auto, responsive)
│   └── print.css          # impression : fiche A4, ou A5 (deux par feuille)
├── data/
│   ├── ingredients.json   # base d'ingrédients : valeurs pour 100 g, rayon, poids par pièce
│   └── recipes.json       # recettes officielles (modèle §3.1 du brief)
├── js/
│   ├── config.js          # tous les paramètres ajustables (facteurs, g/kg, points, catégories, tags…)
│   ├── nutrition.js       # formules §4 : âge, BMR, TDEE, cible, macros, points, budgets
│   ├── profile.js         # modèle du profil, pesées, validation, cibles d'un profil
│   ├── store.js           # localStorage, migrations, export / import JSON
│   ├── recipes.js         # chargement, macros et points d'une recette, portions, filtres, validation des données
│   ├── router.js          # routes #/…
│   ├── app.js             # point d'entrée : état, routage, catalogue, actions
│   └── ui/
│       ├── dom.js         # gabarits HTML échappés, formats fr-BE, toast, fichiers
│       ├── icons.js
│       ├── dashboard.js
│       ├── profile-form.js
│       ├── recipes-list.js
│       └── recipe-detail.js
├── tests/                 # node --test
├── CLAUDE.md              # brief + état d'avancement
└── package.json           # scripts test / start, aucune dépendance
```

## Ajouter une recette

Ajouter une entrée dans `data/recipes.json` (modèle §3.1 du brief) en référençant des ingrédients de `data/ingredients.json` ; les macros et les points sont calculés, jamais saisis. `npm test` vérifie la cohérence des deux fichiers (références, unités, poids par pièce, catégories, tags).
