-- NutriPrep IA — schéma PostgreSQL (Supabase), étape v0.2
-- Les valeurs nutritionnelles des recettes sont DÉRIVÉES de recipe_ingredients × ingredients
-- (table de référence FCEN/USDA), puis dénormalisées pour la performance.

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  age smallint, sexe text check (sexe in ('F','H')),
  poids_kg numeric, taille_cm numeric,
  niveau_activite text, freq_entrainement smallint, duree_entrainement_min smallint,
  marche_min_jour smallint,
  objectif text check (objectif in ('perte','maintien','masse')),
  rythme_lb_semaine numeric check (rythme_lb_semaine <= 1),
  regime text, nb_collations smallint, medical boolean default false,
  interet_microbiote text, updated_at timestamptz default now()
);

create table ingredients (
  id bigint generated always as identity primary key,
  nom_fr text not null, categorie text not null,
  unite_base text check (unite_base in ('g','ml','un')),
  kcal_100 numeric, prot_100 numeric, gluc_100 numeric, lip_100 numeric, fibres_100 numeric,
  est_prebiotique boolean default false, est_fermente boolean default false,
  niveau_transformation smallint check (niveau_transformation between 1 and 4),
  substitutions jsonb
);

create table recipes (
  id bigint generated always as identity primary key,
  nom text not null, type_repas text not null,
  regimes_compatibles text[] not null,
  nb_portions smallint default 1,
  temps_prep_min smallint, temps_cuisson_min smallint,
  conservation_frigo_jours smallint, congelable boolean default false,
  moment_prep text check (moment_prep in ('dimanche','misemaine','frais')),
  etapes jsonb not null, tags text[],
  -- dénormalisé (recalculé par trigger ou tâche) :
  kcal_portion numeric, prot_portion numeric, gluc_portion numeric,
  lip_portion numeric, fibres_portion numeric, score_microbiote smallint
);

create table recipe_ingredients (
  recipe_id bigint references recipes on delete cascade,
  ingredient_id bigint references ingredients,
  quantite numeric not null, unite text not null, note text,
  primary key (recipe_id, ingredient_id)
);

create table allergies (
  profile_id uuid references profiles on delete cascade,
  ingredient_id bigint references ingredients,
  type text check (type in ('allergie','intolerance','evite')),
  primary key (profile_id, ingredient_id)
);

create table menus (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade,
  date_debut date, duree_jours smallint default 7, seed integer,
  contenu jsonb not null, -- MenuGenere sérialisé (jours + compte)
  created_at timestamptz default now()
);

-- RLS (Loi 25 : données de santé → accès strictement personnel)
alter table profiles enable row level security;
alter table allergies enable row level security;
alter table menus enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = user_id);
create policy "own menus" on menus for all
  using (profile_id in (select id from profiles where user_id = auth.uid()));
create policy "own allergies" on allergies for all
  using (profile_id in (select id from profiles where user_id = auth.uid()));
