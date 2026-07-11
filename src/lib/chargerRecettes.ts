import { supabase } from "./supabase";
import type { Recette, Cat, MomentPrep, TypeRepas } from "../engine/types";

/** Charge toutes les recettes depuis Supabase et les remet dans le format
 *  attendu par le moteur (identique à src/engine/data/recettes.ts). */
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
    k: r.kcal_portion ?? 0,
    p: r.prot_portion ?? 0,
    fb: r.fibres_portion ?? 0,
    gl: r.gluc_portion ?? 0,
    lp: r.lip_portion ?? 0,
    micro: r.score_microbiote ?? 0,
    prep: r.temps_prep_min ?? 0,
    cuis: r.temps_cuisson_min ?? 0,
    cons: r.conservation_frigo_jours ?? 4,
    cong: r.congelable ?? false,
    moment: r.moment_prep as MomentPrep,
    tags: (r.tags as string[]) ?? [],
    ing: (r.recipe_ingredients as any[]).map((ri) => [
      ri.ingredients.nom_fr,
      ri.quantite,
      ri.unite,
      ri.ingredients.categorie as Cat,
    ]),
    et: (r.etapes as string[]) ?? [],
  }));
}
