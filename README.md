# Rehab · raisonnement clinique (Streamlit)

PhysioTest est une application inspirée de Build Your Rehab, sans carte de tuiles reliées par des fils.
L'accueil propose une carte corporelle pour ouvrir l'une des huit régions, puis un parcours guidé
(Red Flags, anamnèse, examen, synthèse) qui met à jour les probabilités diagnostiques avec les
rapports de vraisemblance des tests.

## Lancer

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Contenu

| Onglet | Rôle |
|---|---|
| Red Flags | Drapeaux rouges classés urgent / rapide / à surveiller, avec l'orientation à donner |
| Anamnèse | Questions qui déplacent les probabilités de départ (heuristique pédagogique) |
| Examen | Tests par hypothèse (Se, Sp, LR+, LR−, source) et règles de prédiction ; probabilité mise à jour en direct |
| Synthèse | Graphique avant/après, compte rendu téléchargeable en Markdown |
| Tests et valeurs | Page accessible depuis la bannière, tableau filtrable et espace ROC |
| Sources | Page accessible depuis la bannière, références de la région sélectionnée |

L'accueil explique le rôle pédagogique de l'outil et permet de sélectionner une région
sur une carte corporelle. La bannière supérieure donne accès à Accueil, Régions,
Tests et valeurs et Sources. Il n'y a pas de menu latéral.

## Fiabilité des données (à lire)

Chaque test porte un badge :

- **valeur vérifiée** : retrouvée dans la source (ou dans une revue qui la cite) pendant la construction ;
- **à vérifier** : valeur issue de la mémoire du modèle. À contrôler dans l'article avant tout usage.

`python tools/check_data.py` donne le décompte par région. Les probabilités de départ (`prev`) et les poids
de l'anamnèse sont des estimations pédagogiques, pas des données publiées.

Limites assumées : les tests sont multipliés comme s'ils étaient indépendants (l'application avertit
quand plusieurs tests visent la même hypothèse) ; les règles d'exclusion (Ottawa, CCR, NEXUS) n'ont de sens
que pour un résultat négatif.

## Ajouter ou corriger une région

Chaque région est un fichier dans `regions/` décrit avec `RF` (Red Flag), `H` (hypothèse), `Q` (question),
`T` (test) et `C` (règle de prédiction), voir `regions/_dsl.py`. Enregistre le module dans
`regions/__init__.py`, puis lance `python tools/check_data.py` et `python tools/smoke_test.py`.

## Reprise du contenu de Build Your Rehab

Le site construit ses cartes en JavaScript : un simple téléchargement de la page ne renvoie que l'ossature.
`tools/dump_byr.py` enregistre le rendu et les fichiers de données des quatre premières régions
dans `byr_dump/`. Les tableaux cliniques, sous-types et orientations visibles dans ces rendus
servent à compléter les fichiers de `regions/`. Le dump ne fournit pas toujours les noms ou les
valeurs diagnostiques détaillées des tests : aucune Se/Sp n'est inventée lorsqu'elle n'y figure pas.

## Version web Vercel

La version professionnelle Next.js se trouve dans [`web/`](./web/). La version Streamlit
à la racine est conservée comme référence et solution de secours. La version web reprend
les huit régions et leurs données cliniques exportées dans `web/src/data/regions.json`,
avec une interface responsive, une carte corporelle, des animations, les Red Flags,
l'anamnèse, l'examen, la synthèse, la bibliothèque des tests et les sources.

```bash
cd web
npm install
npm run dev
```

Le fichier `vercel.json` déclare Next.js sans remplacer les commandes automatiques de Vercel.
Le projet Vercel doit utiliser la racine du dépôt comme **Root Directory** (et non `web/`).
La commande de production validée est `npm run build`.
