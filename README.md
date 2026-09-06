# 365Food — Livre de recettes « healthy plaisir »

Application web **100 % statique** (HTML / CSS / JS en modules ES, sans serveur ni dépendance) qui remplace un livre de recettes papier : besoins personnels, budget de **points**, recettes gourmandes mais légères et riches en protéines, planning et impression.

Le cahier des charges complet est dans [`CLAUDE.md`](./CLAUDE.md) (formules §4, feuille de route §7, état d'avancement §9).

## État : V4 — Finitions ✅ (feuille de route livrée)

- **V0 — Socle** : profil (âge calculé, sexe, taille, poids, activité, objectif, réglages g/kg), cibles du jour (Mifflin-St Jeor → dépense → cible avec plancher → macros), budget de points quotidien et hebdomadaire, pesées, stockage local, export / import JSON.
- **V1 — Recettes** : base d'ingrédients (`data/ingredients.json`, valeurs pour 100 g), recettes officielles (`data/recipes.json`), macros et points calculés automatiquement, catalogue avec recherche et filtres (catégorie, points max, temps max, tags), fiche recette avec portions ajustables, impression A4 ou A5.
- **V2 — Planning** : semaine par jours et créneaux (matin, midi, soir, snack), ajout de recettes par sélection, portions, « Midi = restes d'hier soir », jauges de points et de protéines par jour et par semaine, liste de courses agrégée par rayon avec cases à cocher, impression de la semaine et de la liste, menu du jour sur le tableau de bord.
- **V3 — Contenu** : catalogue de 78 recettes (11 sauces, 11 matins, 15 midis express en 10 minutes, 31 dîners pour 2 avec la note « le lendemain », 10 desserts & snacks) sur une base de 132 ingrédients, catalogue groupé par catégorie, rappel de pesée à l'échéance (invite sur l'accueil), courbe de l'historique de poids.
- **V4 — Finitions** : application installable (PWA : `manifest.json`, icônes, service worker qui met le shell en cache, fonctionne hors ligne et propose de recharger quand une nouvelle version est en ligne), apparence automatique / claire / sombre, **recettes perso** (formulaire avec ingrédients résolus dans la base, macros et points calculés en direct, ou macros saisies à la main ; « Ma version » d'une recette officielle ; filtre « Mes recettes » ; recettes incluses dans la sauvegarde JSON), polish visuel.
- **Tests** des formules, du stockage, du catalogue, du planning, des recettes perso, de l'apparence, de la PWA et de la cohérence des fichiers de données (`npm test`, aucune dépendance).

## Lancer l'application

Les modules ES sont bloqués par Chrome/Edge lorsqu'on ouvre `index.html` directement en `file://` (Firefox l'accepte). Il suffit d'un petit serveur statique :

```bash
npm start                    # python3 -m http.server 8080
# ou : npx serve .
```

puis ouvrir <http://localhost:8080>. En production, le dépôt est publié tel quel sur **GitHub Pages** (workflow `.github/workflows/ci.yml`, déploiement depuis la branche par défaut).

Sur téléphone, l'application s'installe depuis le navigateur (« Ajouter à l'écran d'accueil » ; bouton « Installer sur l'appareil » sur l'accueil quand le navigateur le propose). Une fois ouverte une première fois, elle fonctionne hors ligne ; à chaque nouvelle version publiée, un message « Nouvelle version disponible » propose de recharger.

## Tests

```bash
npm test
```

Node ≥ 20 (test runner intégré). Les tests couvrent chaque formule du brief §4 avec le profil de référence (homme, 36 ans, 180 cm, 80 kg, activité modérée, −15 % → 2 306 kcal · P 144 g · L 72 g · G 271 g · 31,5 points / jour · 242,5 points / semaine), les cas limites (plancher kcal, glucides tronqués, arrondi au demi-point, minimum 0, bonus fibres, malus sucres), la validation du profil, les pesées, les migrations de schéma, l'aller-retour export / import, le calcul des macros et des points d'une recette, l'ajustement des portions, les filtres, le planning (semaine, restes, totaux, liste de courses, migrations), le routage, les recettes perso (identifiants, résolution des ingrédients, construction depuis le formulaire, validation, normalisation), l'apparence, la PWA (manifest, icônes, liste de cache du service worker complète) et la cohérence de `data/recipes.json` avec `data/ingredients.json`.

## Structure

```
/
├── index.html
├── manifest.json          # PWA : nom, icônes, écran d'accueil
├── sw.js                  # service worker : shell en cache, hors ligne, mise à jour signalée
├── css/
│   ├── app.css            # écran (dégradé menthe / gris, cartes, apparence auto / claire / sombre, responsive)
│   └── print.css          # impression : fiche A4, ou A5 (deux par feuille)
├── data/
│   ├── ingredients.json   # base d'ingrédients : valeurs pour 100 g, rayon, poids par pièce
│   └── recipes.json       # recettes officielles (modèle §3.1 du brief)
├── img/                   # icône de l'application (SVG + PNG 192 / 512 / maskable / Apple)
├── js/
│   ├── config.js          # tous les paramètres ajustables (facteurs, g/kg, points, catégories, tags…)
│   ├── nutrition.js       # formules §4 : âge, BMR, TDEE, cible, macros, points, budgets
│   ├── charts.js          # courbe de l'historique de poids (coordonnées SVG)
│   ├── profile.js         # modèle du profil, pesées, rappel de pesée, validation, cibles d'un profil
│   ├── store.js           # localStorage, migrations, export / import JSON
│   ├── recipes.js         # catalogue (officiel + perso), macros et points d'une recette, portions, filtres, validation des données
│   ├── custom-recipes.js  # recettes perso : identifiants, résolution des ingrédients, formulaire → recette, validation
│   ├── planner.js         # semaine, créneaux, restes du midi, totaux, liste de courses
│   ├── theme.js           # apparence automatique / claire / sombre
│   ├── router.js          # routes #/…
│   ├── app.js             # point d'entrée : état, routage, catalogue, actions, service worker
│   └── ui/
│       ├── dom.js         # gabarits HTML échappés, formats fr-BE, toast, fichiers
│       ├── icons.js
│       ├── dashboard.js
│       ├── profile-form.js
│       ├── recipes-list.js
│       ├── recipe-detail.js
│       ├── recipe-form.js # formulaire de recette perso
│       └── planner.js
├── tests/                 # node --test
├── CLAUDE.md              # brief + état d'avancement
└── package.json           # scripts test / start, aucune dépendance
```

## Ajouter une recette

Dans l'application : **Recettes → Nouvelle recette** (ou « Ma version » sur une fiche officielle). Les ingrédients se choisissent dans la base, les macros et les points se calculent en direct ; la recette reste sur l'appareil et fait partie de la sauvegarde JSON.

Dans le catalogue officiel : ajouter une entrée dans `data/recipes.json` (modèle §3.1 du brief) en référençant des ingrédients de `data/ingredients.json` ; les macros et les points sont calculés, jamais saisis. `npm test` vérifie la cohérence des deux fichiers (références, unités, poids par pièce, catégories, tags). Tout nouveau fichier de l'application doit aussi figurer dans la liste `SHELL` de `sw.js` (vérifié par les tests).
