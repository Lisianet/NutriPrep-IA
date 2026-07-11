# NutriPrep IA

Assistant nutritionnel : profil → besoins calculés → menu 7 jours meal prep, recettes détaillées, plan de préparation et liste d'épicerie consolidée. Végétarien/végétalien, orienté santé du microbiote.

> ⚕️ Les recommandations sont informatives et ne remplacent pas l'avis d'un médecin, nutritionniste ou diététiste.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires des moteurs (Vitest)
npm run typecheck  # vérification TypeScript
npm run build      # build de production (dist/)
```

## Structure

```
src/
├── engine/                 ← moteurs PURS (aucune dépendance UI, 100 % testables)
│   ├── types.ts            Types partagés (Profil, Recette, Cibles, Menu…)
│   ├── calculs.ts          Mifflin-St Jeor, NAF, cibles + garde-fous
│   ├── filtrage.ts         Filtres durs : régime, allergènes
│   ├── generation.ts       Squelette meal prep, portions à l'échelle du profil (déterministe)
│   ├── epicerie.ts         Agrégation des ingrédients par catégorie
│   ├── prep.ts             Plan de préparation + diversité végétale
│   ├── data/               Banque seed (28 recettes, 9 collations)
│   └── __tests__/          Tests Vitest de chaque moteur
├── lib/supabase.ts         Stub de persistance (étape v0.2)
├── App.tsx                 Interface (questionnaire, tableau de bord, menu…)
└── main.tsx
supabase/schema.sql          Schéma PostgreSQL + politiques RLS
netlify.toml                 Déploiement Netlify (build → dist/)
```

## Principes d'architecture

- **Moteurs = fonctions pures.** `calculerCibles`, `genererMenu`, `listeEpicerie`, `planPrep` prennent des données et retournent des données. L'UI ne fait que les afficher. C'est ce qui permet de les tester, puis de les réutiliser tels quels dans une app mobile ou un backend.
- **Filtres durs jamais contournés.** Régime et allergènes éliminent des recettes avant toute optimisation ; si la banque devient vide, le générateur retourne une erreur honnête plutôt qu'un menu bancal.
- **Garde-fous intégrés.** Rythme de perte plafonné à 1 lb/sem, plancher calorique (1400 F / 1600 H, jamais sous 95 % du BMR), mode « information générale » sans déficit si condition médicale déclarée.
- **Génération déterministe.** Même profil + même seed → même menu. « Régénérer » incrémente la seed.

## Déployer sur Netlify

1. Pousser le repo sur GitHub.
2. Netlify → *Add new site* → *Import from Git* → sélectionner le repo.
3. `netlify.toml` fournit déjà la commande (`npm run build`) et le dossier (`dist`).

## Brancher Supabase (v0.2)

Voir les instructions dans `src/lib/supabase.ts` et le schéma dans `supabase/schema.sql`
(RLS activé : chaque utilisateur ne voit que ses propres données — pertinent Loi 25).

## Feuille de route

- [ ] Persistance profil + menus (Supabase)
- [ ] Banque de recettes en BD, valeurs recalculées depuis les ingrédients (FCEN)
- [ ] Suivi du poids (moyenne mobile 7 j) + ajustement automatique des cibles
- [ ] Export PDF, mode famille, budget, saisonnalité Québec
