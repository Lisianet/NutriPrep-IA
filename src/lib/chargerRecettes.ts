import { supabase } from "./supabase";
import type { Recette, Cat, MomentPrep, TypeRepas } from "../engine/types";

/** Charge toutes les recettes depuis Supabase et les remet dans le format
 *  attendu par le moteur (identique à src/engine/data/recettes.ts).
 *
 *  Important : les colonnes Postgres de type "numeric" (kcal_portion,
 *  prot_portion, gluc_portion, lip_portion, fibres_portion, quantite) sont
 *  renvoyées par Supabase sous forme de TEXTE (ex. "390" au lieu de 390).
 *  On les convertit explicitement avec Number(...) pour éviter que les
 *  additions du moteur (ex. "10" + "20") ne fassent de la concaténation
 *  de texte au lieu d'un calcul numérique. */
export async function chargerRecettes(): Promise<Recette[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, nom, type_repas, regimes_compatibles,
      temps_prep_min, temps_cuisson_min, conservation_frigo_jours, congelable,
      moment_prep, etapes, tags,
      kcal_portion, prot_portion, gluc_portion, lip_portion, fibres_portion, score_microbiote,
      recipe_ingredients ( quantite, unite, ingredients ( nom_fr, categorie ) )
    `);

  if (error) throw new Error(`Impossible de charger les recettes depuis Supabase : ${error.message}`);
  if (!data) return [];

  return data.map((r): Recette => ({
    id: String(r.id),
    nom: r.nom,
    type: r.type_repas as TypeRepas,
    regimes: r.regimes_compatibles as Recette["regimes"],
    k: Number(r.kcal_portion ?? 0),
    p: Number(r.prot_portion ?? 0),
    fb: Number(r.fibres_portion ?? 0),
    gl: Number(r.gluc_portion ?? 0),
    lp: Number(r.lip_portion ?? 0),
    micro: Number(r.score_microbiote ?? 0),
    prep: Number(r.temps_prep_min ?? 0),
    cuis: Number(r.temps_cuisson_min ?? 0),
    cons: Number(r.conservation_frigo_jours ?? 4),
    cong: r.congelable ?? false,
    moment: r.moment_prep as MomentPrep,
    tags: (r.tags as string[]) ?? [],
    ing: (r.recipe_ingredients as any[]).map((ri) => [
      ri.ingredients.nom_fr,
      Number(ri.quantite),
      ri.unite,
      ri.ingredients.categorie as Cat,
    ]),
    et: (r.etapes as string[]) ?? [],
  }));
}
