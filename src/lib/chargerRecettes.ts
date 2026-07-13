import { supabase } from "./supabase";
import type { Recette, Cat, MomentPrep, TypeRepas } from "../engine/types";
/** Charge toutes les recettes depuis Supabase et les remet dans le format
 *  attendu par le moteur (identique à src/engine/data/recettes.ts).
 *
 *  Important : les colonnes Postgres de type "numeric" (kcal_portion,
 *  prot_portion, gluc_portion, lip_portion, fibres_portion, quantite, et les
 *  micronutriments) sont renvoyées par Supabase sous forme de TEXTE (ex.
 *  "390" au lieu de 390). On les convertit explicitement avec Number(...)
 *  pour éviter que les additions du moteur (ex. "10" + "20") ne fassent de
 *  la concaténation de texte au lieu d'un calcul numérique.
 *
 *  v4 : ajoute le drapeau "indivisible" par ingrédient (pour l'arrondi des
 *  portions dans FicheRecette) et les micronutriments par portion, exposés
 *  en usage interne seulement — jamais affichés dans l'interface.
 *
 *  Note : la table "recipes" n'a pas de colonne nb_portions — les quantités
 *  de recipe_ingredients doivent donc être saisies directement PAR PORTION
 *  à la source (pas pour un lot). Si une recette affiche des quantités trop
 *  élevées (ex. 4 bananes pour 1 portion de smoothie), c'est une erreur de
 *  saisie à corriger dans recipe_ingredients, pas quelque chose que ce
 *  chargeur peut déduire automatiquement. */
export async function chargerRecettes(): Promise<Recette[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, nom, type_repas, regimes_compatibles,
      temps_prep_min, temps_cuisson_min, conservation_frigo_jours, congelable,
      moment_prep, etapes, tags,
      kcal_portion, prot_portion, gluc_portion, lip_portion, fibres_portion, score_microbiote,
      fer_mg_portion, calcium_mg_portion, zinc_mg_portion, b12_ug_portion,
      magnesium_mg_portion, potassium_mg_portion, omega3_g_portion,
      recipe_ingredients ( quantite, unite, ingredients ( nom_fr, categorie, indivisible ) )
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
      Boolean(ri.ingredients.indivisible),
    ]),
    et: (r.etapes as string[]) ?? [],
    micronutriments: {
      fer_mg: Number(r.fer_mg_portion ?? 0),
      calcium_mg: Number(r.calcium_mg_portion ?? 0),
      zinc_mg: Number(r.zinc_mg_portion ?? 0),
      b12_ug: Number(r.b12_ug_portion ?? 0),
      magnesium_mg: Number(r.magnesium_mg_portion ?? 0),
      potassium_mg: Number(r.potassium_mg_portion ?? 0),
      omega3_g: Number(r.omega3_g_portion ?? 0),
    },
  }));
}
