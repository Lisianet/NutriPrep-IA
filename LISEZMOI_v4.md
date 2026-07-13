# NutriPrep IA — v4 : ce qu'il faut faire

## ⚠️ D'abord, corriger le pépin du v3

Le script v3 que tu as exécuté a créé des tables avec de mauvais noms de colonnes.
**Exécute `01_schema_v4.sql` puis `02_seed_v4.sql`** dans Supabase (même façon que
la dernière fois : SQL Editor → New query → coller → Run). Le `DROP TABLE` du
schéma v4 va simplement écraser la mauvaise version.

À la fin de `02_seed_v4.sql`, tu dois voir : **75 recettes** (20 dej, 33 din, 22 soup),
**133 ingrédients**, et un nombre de liens (~600+).

## Ce qui a changé par rapport à ce que je t'avais montré avant

J'ai dû ajuster pas mal de choses en voyant ton vrai code :

| Élément | Avant (ma proposition v3) | Maintenant (v4, aligné sur ton app) |
|---|---|---|
| Type de recette | `dejeuner/repas/collation` | `dej/din/soup` (dîner et souper séparés) — collations gérées à part |
| Catégorie épicerie | pas de viande/poisson | ajout de `V` (Viandes, volailles & poissons) |
| Œufs/tortillas | — | ajout du drapeau `indivisible` par ingrédient |
| Micronutriments | table séparée | champs cachés sur `recipes` (ex. `fer_mg_portion`), jamais affichés |
| Collations | dans Supabase | **restent statiques** dans `data/collations.ts` (comme ton app le fait déjà) |

## Fichiers à copier dans ton projet

1. **`01_schema_v4.sql`** puis **`02_seed_v4.sql`** → dans Supabase (voir plus haut)
2. **`types.ts`** → remplace `src/engine/types.ts`
   - Ajoute la catégorie `V`, l'allergène poisson/fruits de mer, le drapeau `indivisible`
   - Ajoute `regimes: Regime[]` — **attention**, avant, un profil « végétarien » ne filtrait
     jamais rien (bug latent, sans conséquence tant que la banque était 100 % végé).
     Maintenant qu'on ajoute des recettes omnivores, **c'est corrigé** : un profil
     végétarien ne verra plus de viande. Vérifie que ça ne casse rien chez toi.
3. **`filtrage.ts`** → remplace `src/engine/filtrage.ts` (nouveaux mots-clés allergènes + le correctif ci-dessus)
4. **`chargerRecettes.ts`** → remplace `src/lib/chargerRecettes.ts` (ajoute `indivisible` + micronutriments internes)
5. **`generation.ts`** → remplace `src/engine/generation.ts` (rotation des collations sur toute la semaine, voir plus bas)
6. **`collations.ts`** → remplace `src/engine/data/collations.ts` (25 nouvelles collations)

## Correctif collations qui se répètent

Avant, le moteur évitait les répétitions seulement **à l'intérieur d'une même journée**.
Maintenant, `generation.ts` pioche dans un « paquet » mélangé une fois par semaine : une
collation ne revient que lorsque toutes les autres ont été servies. Avec 25 collations
disponibles et au plus ~21 collations à combler dans la semaine (3/jour × 7), tu ne
devrais quasiment plus jamais voir de répétition.

**Compromis à connaître** : pour simplifier cette rotation, j'ai retiré l'ancienne logique
qui choisissait la collation la mieux adaptée à l'écart de calories/protéines restant.
La sélection est maintenant aléatoire (mais sans répétition), pas optimisée. Si tu
préfères récupérer un mélange des deux (rotation + pertinence), dis-le-moi.

## Changements à faire toi-même dans `App.tsx` (2 petits blocs)

**1) Arrondir les indivisibles dans la fiche recette.** Dans `FicheRecette`, remplace :

```tsx
const fmt = (q: number) => fr(q * portions);
```

par :

```tsx
const fmt = (q: number, indivisible?: boolean) =>
  fr(indivisible ? Math.max(1, Math.round(q * portions)) : q * portions);
```

et plus bas, dans la liste d'ingrédients :

```tsx
{r.ing.map(([nom, q, u]) => <li key={nom}>{fmt(q)} {u} — {nom}</li>)}
```

devient :

```tsx
{r.ing.map(([nom, q, u, , indiv]) => <li key={nom}>{fmt(q, indiv)} {u} — {nom}</li>)}
```

**2) Cacher « toute la banque » dans `VueRecettes`.** Supprime tout le bloc qui commence par :

```tsx
<h3 style={{ fontFamily: FONT_D, fontSize: 20, margin: "14px 0 0" }}>Toute la banque ({recettes.length} recettes)</h3>
{TYPES.map(([t, titre]) => ( ... ))}
```

pour ne garder que la section « Cette semaine ({semaine.length}) » juste au-dessus. La liste
`TYPES` et la variable ne serviront plus qu'à ça — tu peux aussi la retirer si elle n'est
plus utilisée ailleurs.

## Ce qui reste en suspens (dis-moi ce que tu veux prioriser)

- Les micronutriments sont calculés et stockés, mais **rien dans `generation.ts` ne
  les utilise encore** pour choisir entre deux recettes équivalentes. Je peux ajouter
  cette logique si tu veux qu'elle influence réellement la composition du menu.
- Le classement dîner/souper des 55 recettes que j'avais faites en « repas » est une
  répartition **par heuristique** (mots-clés dans le nom) — à vérifier, quelques-unes
  pourraient être mieux classées autrement.
- Le compromis rotation vs pertinence des collations (voir plus haut).
