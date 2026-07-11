import type { Cat, Collation, MenuGenere, Recette } from "./types";
import { RECETTES } from "./data/recettes";
import { COLLATIONS } from "./data/collations";

export interface ItemEpicerie { nom: string; u: string; c: Cat; q: number; }

const arrondir = (it: ItemEpicerie): number =>
  it.u === "g" ? Math.ceil(it.q / 5) * 5
  : it.u === "ml" ? Math.ceil(it.q / 10) * 10
  : Math.ceil(it.q * 2) / 2;

/** Agrège les ingrédients de toutes les portions de la semaine, par catégorie. */
export function listeEpicerie(
  menu: MenuGenere,
  recettes: Recette[] = RECETTES,
  collations: Collation[] = COLLATIONS
): Partial<Record<Cat, ItemEpicerie[]>> {
  const agg: Record<string, ItemEpicerie> = {};
  Object.entries(menu.compte).forEach(([id, n]) => {
    const recette = recettes.find((x) => x.id === id);
    const r = recette ?? collations.find((x) => x.id === id);
    if (!r) return;
    const facteur = recette ? menu.portionsRepas : 1; // les collations restent à ×1
    r.ing.forEach(([nom, q, u, c]) => {
      const cle = `${nom}|${u}`;
      if (!agg[cle]) agg[cle] = { nom, u, c, q: 0 };
      agg[cle].q += q * n * facteur;
    });
  });
  const parCat: Partial<Record<Cat, ItemEpicerie[]>> = {};
  Object.values(agg).forEach((it) => {
    (parCat[it.c] = parCat[it.c] ?? []).push({ ...it, q: arrondir(it) });
  });
  Object.values(parCat).forEach((l) => l!.sort((a, b) => a.nom.localeCompare(b.nom)));
  return parCat;
}
