import type { Cibles, Collation, JourMenu, MomentPrep, Profil, Recette, ResultatMenu, TypeRepas } from "./types";
import { JOURS } from "./types";
import { filtrer } from "./filtrage";
import { RECETTES } from "./data/recettes";
import { COLLATIONS } from "./data/collations";

/** Générateur pseudo-aléatoire déterministe (même seed → même menu). */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function melanger<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Squelette hebdomadaire (index de recette par jour, lun → dim), aligné sur
 * les trois blocs de préparation :
 *   slot 0 → servi en début de semaine  → cuisiné le DIMANCHE
 *   slot 1 → servi mer/jeu → dim        → cuisiné le MERCREDI soir
 *   slot 2 → servi sam/dim              → cuisiné FRAIS en fin de semaine
 * Aucune recette n'est donc servie avant son jour de préparation.
 */
const PATRONS: Record<TypeRepas, number[]> = {
  dej: [0, 0, 0, 1, 1, 1, 1],
  din: [0, 0, 0, 1, 1, 2, 2],
  soup: [0, 0, 1, 1, 1, 2, 2],
};

/** Priorité d'affectation aux slots : les plus « meal prep » d'abord. */
const RANG_MOMENT: Record<MomentPrep, number> = { dimanche: 0, misemaine: 1, frais: 2 };

/**
 * Menu 7 jours : filtres durs → squelette en lots (2 déj / 3 dîners / 3 soupers)
 * → collations choisies pour combler l'écart calories-protéines.
 */
export function genererMenu(
  pr: Profil,
  cibles: Cibles,
  seed: number,
  recettes: Recette[] = RECETTES,
  collations: Collation[] = COLLATIONS
): ResultatMenu {
  const rand = rng(seed * 7919 + 17);
  const pool = filtrer(recettes, pr);
  const colls = filtrer(collations, pr);

  /** n recettes du type t. Les slots servis en début de période exigent des
   *  recettes préparables à l'avance ; les recettes « fraîches » ne sont
   *  utilisées que pour le dernier slot des soupers (cuisine du vendredi),
   *  ou en dépannage si la banque filtrée est trop petite. */
  const choisir = (t: TypeRepas, n: number): Recette[] => {
    const cand = melanger(pool.filter((r) => r.type === t), rand);
    const nonFrais = cand.filter((r) => r.moment !== "frais");
    const frais = cand.filter((r) => r.moment === "frais");
    const nbPreparables = t === "soup" ? n - 1 : n;
    const sel: Recette[] = [];
    while (sel.length < nbPreparables && nonFrais.length) sel.push(nonFrais.shift()!);
    while (sel.length < n && frais.length) sel.push(frais.shift()!);
    while (sel.length < n && nonFrais.length) sel.push(nonFrais.shift()!);
    return sel.sort((a, b) => RANG_MOMENT[a.moment] - RANG_MOMENT[b.moment]);
  };

  const dej = choisir("dej", 2);
  const din = choisir("din", 3);
  const soup = choisir("soup", 3);

  if (!dej.length || !din.length || !soup.length) {
    return { erreur: "Trop de recettes exclues par les contraintes — la banque MVP est encore petite. Retirez une contrainte ou élargissez la banque." };
  }

  const idx = <T,>(arr: T[], i: number) => arr[Math.min(i, arr.length - 1)];

  /* --- Adaptation aux besoins : portions des repas mises à l'échelle ---
     La banque est calibrée ~1 330 kcal / jour en repas (à ×1) + collations.
     Un profil « prise de masse » à 3 000 kcal recevra ×2 ; une petite
     personne en perte, ×0,75. Quantifié au quart de portion pour rester
     cuisinable, borné [0,75 ; 2]. */
  const baseJour = (i: number) =>
    idx(dej, PATRONS.dej[i]).k + idx(din, PATRONS.din[i]).k + idx(soup, PATRONS.soup[i]).k;
  const baseMoyenne = [0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + baseJour(i), 0) / 7;
  const budgetCollations = pr.collations * 150;
  const portionsRepas = Math.min(2, Math.max(0.75,
    Math.round(((cibles.kcal - budgetCollations) / baseMoyenne) * 4) / 4));

  const jours: JourMenu[] = JOURS.map((jour, i) => {
    const repas = [
      { moment: "Déjeuner", r: idx(dej, PATRONS.dej[i]) },
      { moment: "Dîner", r: idx(din, PATRONS.din[i]) },
      { moment: "Souper", r: idx(soup, PATRONS.soup[i]) },
    ];
    let k = repas.reduce((s, m) => s + m.r.k, 0) * portionsRepas;
    let p = repas.reduce((s, m) => s + m.r.p, 0) * portionsRepas;
    const snacks: Collation[] = [];
    const dispo = melanger(colls, rand);
    for (let n = 0; n < pr.collations; n++) {
      const gapK = cibles.kcal - k;
      const gapP = cibles.prot - p;
      if (gapK < 110) break;
      const reste = pr.collations - n;
      const choix = dispo
        .filter((c) => !snacks.includes(c))
        .sort((a, b) => {
          const score = (c: Collation) =>
            (gapP > 12 ? c.p * 3 : 0) - Math.abs(gapK / reste - c.k) / 10;
          return score(b) - score(a);
        })[0];
      if (!choix) break;
      snacks.push(choix);
      k += choix.k;
      p += choix.p;
    }
    const fb = repas.reduce((s, m) => s + m.r.fb, 0) * portionsRepas;
    const tous = [...repas.map((m) => m.r as { micro: number }), ...snacks];
    const micro = Math.round(tous.reduce((s, r) => s + r.micro, 0) / tous.length);
    return { jour, repas, snacks, k: Math.round(k), p: Math.round(p), fb: Math.round(fb), micro };
  });

  const compte: Record<string, number> = {};
  jours.forEach((j) => {
    j.repas.forEach((m) => { compte[m.r.id] = (compte[m.r.id] || 0) + 1; });
    j.snacks.forEach((c) => { compte[c.id] = (compte[c.id] || 0) + 1; });
  });

  return { jours, compte, portionsRepas };
}
