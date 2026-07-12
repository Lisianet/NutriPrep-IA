import type { Collation, MenuGenere, Recette } from "./types";
import { RECETTES } from "./data/recettes";
import { COLLATIONS } from "./data/collations";

export const JOURS_ABBR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;

/** Jour réel de cuisson d'un lot. */
export type JourPrep = "dimanche" | "mercredi" | "vendredi";

export interface TachePrep {
  r: Recette;
  /** Portions à cuisiner */
  n: number;
  min: number;
  /** Jours de consommation (abréviations), ex. ["lun","mar","jeu"] */
  jours: string[];
}

export type BlocsPrep = Record<JourPrep, TachePrep[]>;

/** Premier jour de consommation → jour de cuisson. Une recette n'est
 *  JAMAIS cuisinée après sa première consommation. */
const blocPour = (premierJour: number): JourPrep =>
  premierJour <= 1 ? "dimanche" : premierJour <= 4 ? "mercredi" : "vendredi";

/**
 * Plan de préparation dérivé du menu réellement généré :
 * chaque lot est rattaché au bloc de cuisson qui précède sa première consommation.
 */
export function planPrep(
  menu: MenuGenere,
  recettes: Recette[] = RECETTES
): { blocs: BlocsPrep; duree: (l: TachePrep[]) => number } {
  const usage: Record<string, number[]> = {};
  menu.jours.forEach((j, i) => j.repas.forEach((m) => (usage[m.r.id] ??= []).push(i)));

  const blocs: BlocsPrep = { dimanche: [], mercredi: [], vendredi: [] };
  Object.entries(usage).forEach(([id, joursIdx]) => {
    const r = recettes.find((x) => x.id === id);
    if (!r) return;
    blocs[blocPour(Math.min(...joursIdx))].push({
      r,
      n: Math.round(joursIdx.length * menu.portionsRepas * 100) / 100,
      min: r.prep + r.cuis,
      jours: joursIdx.map((d) => JOURS_ABBR[d]),
    });
  });
  (Object.keys(blocs) as JourPrep[]).forEach((m) => blocs[m].sort((a, b) => b.min - a.min));

  /** Durée estimée avec parallélisation four/cuisinière (facteur 0,6). */
  const duree = (l: TachePrep[]) => Math.round(l.reduce((s, t) => s + t.min, 0) * 0.6);
  return { blocs, duree };
}

/** id de recette → jour de cuisson, pour afficher le badge « prép. » dans le menu. */
export function jourPrepParRecette(
  menu: MenuGenere,
  recettes: Recette[] = RECETTES
): Record<string, JourPrep> {
  const { blocs } = planPrep(menu, recettes);
  const map: Record<string, JourPrep> = {};
  (Object.keys(blocs) as JourPrep[]).forEach((b) => blocs[b].forEach((t) => { map[t.r.id] = b; }));
  return map;
}

/** Nombre de végétaux distincts de la semaine (fruits, légumes, légumineuses, grains, noix). */
export function vegetauxDistincts(
  menu: MenuGenere,
  recettes: Recette[] = RECETTES,
  collations: Collation[] = COLLATIONS
): number {
  const set = new Set<string>();
  Object.keys(menu.compte).forEach((id) => {
    const r = recettes.find((x) => x.id === id) ?? collations.find((x) => x.id === id);
    r?.ing.forEach(([nom, , , c]) => { if ("FLGNC".includes(c)) set.add(nom); });
  });
  return set.size;
}
