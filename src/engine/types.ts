/** Types partagés du moteur NutriPrep IA. */
export type Regime = "vegetarien" | "vegetalien" | "omnivore";
export type Allergene = "soya" | "arachides" | "sesame" | "gluten" | "lactose" | "oeufs" | "poisson" | "fruits_de_mer";
/** Catégorie d'épicerie d'un ingrédient. */
export type Cat = "F" | "L" | "P" | "G" | "C" | "N" | "D" | "E" | "S" | "V";
/** [nom, quantité par portion, unité, catégorie, indivisible?]
 *  indivisible = true pour les ingrédients qu'on ne peut pas fractionner
 *  (œufs, tortillas, pains, pitas, bananes, pommes...) : lors de l'ajustement
 *  des portions, la quantité doit être arrondie à l'unité entière (min. 1)
 *  plutôt que divisée (ex. jamais 1,25 œuf). */
export type Ingredient = [string, number, string, Cat, boolean?];
/** Micronutriments par portion — usage INTERNE au générateur seulement
 *  (composition des menus). Ne jamais afficher ces valeurs dans l'interface. */
export interface Micronutriments {
  fer_mg: number; calcium_mg: number; zinc_mg: number; b12_ug: number;
  magnesium_mg: number; potassium_mg: number; omega3_g: number;
}
export type TypeRepas = "dej" | "din" | "soup";
export type MomentPrep = "dimanche" | "misemaine" | "frais";
export interface Recette {
  id: string;
  type: TypeRepas;
  nom: string;
  regimes: Regime[];
  /** kcal, protéines (g), fibres (g), glucides (g), lipides (g) — par portion */
  k: number; p: number; fb: number; gl: number; lp: number;
  /** Score microbiote /100 */
  micro: number;
  prep: number; cuis: number;
  /** Conservation frigo (jours) */
  cons: number;
  cong: boolean;
  moment: MomentPrep;
  tags: string[];
  ing: Ingredient[];
  et: string[];
  /** USAGE INTERNE — jamais affiché. Sert au générateur à équilibrer les menus. */
  micronutriments?: Micronutriments;
}
export interface Collation {
  id: string;
  nom: string;
  regimes: Regime[];
  k: number; p: number;
  micro: number;
  tags: string[];
  ing: Ingredient[];
}
export interface Profil {
  age: number;
  sexe: "F" | "H";
  lb: number;
  pi: number;
  po: number;
  act: "sedentaire" | "leger" | "actif";
  freq: number;
  duree: number;
  marche: number;
  objectif: "perte" | "maintien" | "masse";
  /** lb/semaine, plafonné à 1 */
  rythme: number;
  regime: Regime;
  allergies: Allergene[];
  collations: number;
  medical: boolean;
}
export interface Cibles {
  kg: number; cm: number;
  bmr: number; naf: number; tdee: number;
  kcal: number; prot: number; lip: number; gluc: number; fibres: number;
  objectif: Profil["objectif"];
  /** Apports de référence (RNI) en micronutriments selon l'âge/sexe du profil —
   *  sert uniquement à pondérer le choix des recettes, jamais affiché tel quel. */
  micro: Micronutriments;
}
export interface RepasJour { moment: string; r: Recette; }
export interface JourMenu {
  jour: string;
  repas: RepasJour[];
  snacks: Collation[];
  k: number; p: number; fb: number; micro: number;
}
export interface MenuGenere {
  jours: JourMenu[];
  /** id de recette/collation → nombre d'utilisations dans la semaine */
  compte: Record<string, number>;
  /** Facteur de portions des repas, adapté aux besoins du profil
   *  (ex. 1 = portion de référence ~1650 kcal/j ; 1,5 pour ~2400 ; 2 pour ~3000). */
  portionsRepas: number;
}
export interface MenuErreur { erreur: string; }
export type ResultatMenu = MenuGenere | MenuErreur;
export const estErreur = (m: ResultatMenu): m is MenuErreur => "erreur" in m;
export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const CAT_NOMS: Record<Cat, string> = {
  F: "Fruits", L: "Légumes", P: "Protéines végétales & œufs", G: "Légumineuses",
  C: "Grains entiers", N: "Noix & graines", D: "Laitiers, substituts & fermentés",
  E: "Épices & condiments", S: "Conserves & surgelés", V: "Viandes, volailles & poissons",
};
