import type { Allergene, Ingredient, Profil, Regime } from "./types";

/** Mots-clés d'exclusion stricte par allergène (recherche dans le nom d'ingrédient). */
export const ALLERGENES: Record<Allergene, string[]> = {
  soya: ["soya", "tofu", "edamame", "tempeh", "miso"],
  arachides: ["arachide"],
  sesame: ["tahini", "sésame"],
  gluten: ["pain", "blé"],
  lactose: ["yogourt grec", "feta", "cottage", "kéfir", "parmesan"],
  oeufs: ["œuf"],
};

export const ALLERG_LABELS: Record<Allergene, string> = {
  soya: "Soya", arachides: "Arachides", sesame: "Sésame",
  gluten: "Gluten (blé)", lactose: "Produits laitiers", oeufs: "Œufs",
};

interface Filtrable { regimes: Regime[]; ing: Ingredient[]; }

export const compatibleRegime = (r: Filtrable, regime: Regime): boolean =>
  regime === "vegetalien" ? r.regimes.includes("vegetalien") : true;

export const sansAllergenes = (r: Filtrable, allergies: Allergene[]): boolean =>
  !r.ing.some(([nom]) =>
    allergies.some((a) => ALLERGENES[a].some((kw) => nom.toLowerCase().includes(kw)))
  );

/** Filtres durs : régime + allergies. Jamais contournés par l'optimisation. */
export const filtrer = <T extends Filtrable>(
  liste: T[],
  pr: Pick<Profil, "regime" | "allergies">
): T[] => liste.filter((r) => compatibleRegime(r, pr.regime) && sansAllergenes(r, pr.allergies));
