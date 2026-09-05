# 365Food — Livre de recettes « healthy plaisir »

Application web **100 % statique** (HTML / CSS / JS en modules ES, sans serveur ni dépendance) qui remplace un livre de recettes papier : besoins personnels, budget de **points**, recettes gourmandes mais légères et riches en protéines, planning et impression.

Le cahier des charges complet est dans [`CLAUDE.md`](./CLAUDE.md) (formules §4, feuille de route §7, état d'avancement §9).

## État : V0 — Socle ✅

- **Profil** : prénom facultatif, date de naissance (âge calculé), sexe, taille, poids, activité, objectif avec ajustement réglable, fréquence de pesée, réglages avancés (g/kg de protéines et de lipides).
- **Cibles du jour** : métabolisme de base (Mifflin-St Jeor) → dépense journalière → cible kcal (avec plancher de sécurité) → protéines / lipides / glucides.
- **Budget de points** quotidien et hebdomadaire (jokers +10 %).
- **Pesées** : historique conservé, graphique en pilules des 7 dernières pesées, cibles recalculées à chaque nouvelle pesée.
- **Stockage local** (localStorage), **export / import JSON** de toutes les données, effacement.
- **Tests unitaires** des formules et du stockage (`npm test`, aucune dépendance).

Prochaine étape : **V1 — Recettes** (base d'ingrédients, `recipes.json`, fiche imprimable A4/A5).

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

Node ≥ 20 (test runner intégré). Les tests couvrent chaque formule du brief §4 avec le profil de référence (homme, 36 ans, 180 cm, 80 kg, activité modérée, −15 % → 2 306 kcal · P 144 g · L 72 g · G 271 g · 31,5 points / jour · 242,5 points / semaine), les cas limites (plancher kcal, glucides tronqués, arrondi au demi-point, minimum 0, bonus fibres, malus sucres), la validation du profil, les pesées, les migrations de schéma et l'aller-retour export / import.

## Structure

```
/
├── index.html
├── css/
│   ├── app.css            # écran (style « app santé » : dégradé menthe/gris, tuiles, mode sombre auto)
│   └── print.css          # impression
├── js/
│   ├── config.js          # tous les paramètres ajustables (facteurs, g/kg, points, plancher…)
│   ├── nutrition.js       # formules §4 : âge, BMR, TDEE, cible, macros, points, budgets
│   ├── profile.js         # modèle du profil, pesées, validation, cibles d'un profil
│   ├── store.js           # localStorage, migrations, export / import JSON
│   ├── app.js             # point d'entrée : état, navigation, actions
│   └── ui/
│       ├── dom.js         # gabarits HTML échappés, formats fr-BE, toast, fichiers
│       ├── profile-form.js
│       └── dashboard.js
├── sw.js                  # désinstalle le service worker de l'ancienne app (un vrai arrivera en V4)
├── tests/                 # node --test
├── CLAUDE.md              # brief + état d'avancement
└── package.json           # scripts test / start, aucune dépendance
```

## Données et confidentialité

Aucune donnée ne quitte l'appareil : le profil et l'historique de poids vivent dans le `localStorage` du navigateur. Le bouton **Exporter** produit un fichier `365food-sauvegarde-AAAA-MM-JJ.json` ré-importable sur un autre appareil.
