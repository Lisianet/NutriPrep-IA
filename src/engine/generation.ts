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

/** Ordonne aléatoirement en favorisant les éléments à poids plus élevé
 *  (Efraimidis–Spirakis) : une recette bien notée a plus de chances d'arriver
 *  tôt dans la liste, sans jamais être un choix garanti — préserve la variété
 *  d'une semaine à l'autre pour un même profil. */
function melangerPondere<T>(arr: T[], rand: () => number, poids: (t: T) => number): T[] {
  return arr
    .map((t) => ({ t, cle: Math.pow(rand(), 1 / Math.max(poids(t), 0.01)) }))
    .sort((a, b) => b.cle - a.cle)
    .map((x) => x.t);
}

/** Score une recette selon sa densité en protéines et en fibres (par kcal)
 *  comparée à la densité visée par les cibles du profil. > 1 = plus dense que
 *  la cible, ce qui aide à combler les besoins sans se fier au seul facteur
 *  d'échelle des portions. */
function scoreRecette(r: Recette, cibles: Cibles): number {
  if (!r.k) return 1;
  const densProt = r.p / r.k;
  const densFibres = r.fb / r.k;
  const cibleDensProt = cibles.prot / cibles.kcal;
  const cibleDensFibres = cibles.fibres / cibles.kcal;
  return 0.5 * (densProt / cibleDensProt) + 0.5 * (densFibres / cibleDensFibres);
}

const PATRONS: Record<TypeRepas, number[]> = {
  dej: [0, 0, 0, 1, 1, 1, 1],
  din: [0, 0, 0, 1, 1, 2, 2],
  soup: [0, 0, 1, 1, 1, 2, 2],
};

const RANG_MOMENT: Record<MomentPrep, number> = { dimanche: 0, misemaine: 1, frais: 2 };

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

  const choisir = (t: TypeRepas, n: number): Recette[] => {
    const cand = melangerPondere(pool.filter((r) => r.type === t), rand, (r) => scoreRecette(r, cibles));
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

  const baseJour = (i: number) =>
    idx(dej, PATRONS.dej[i]).k + idx(din, PATRONS.din[i]).k + idx(soup, PATRONS.soup[i]).k;
  const baseMoyenne = [0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + baseJour(i), 0) / 7;
  const budgetCollations = pr.collations * 150;
  const portionsRepas = Math.min(2, Math.max(0.75,
    Math.round(((cibles.kcal - budgetCollations) / baseMoyenne) * 4) / 4));

  // --- Rotation des collations SUR TOUTE LA SEMAINE, pas seulement par jour ---
  // On mélange une seule fois la banque filtrée en un « paquet » qu'on consomme
  // au fur et à mesure ; une collation ne revient qu'une fois le paquet épuisé
  // (donc jamais deux fois tant qu'il reste une collation non servie cette semaine).
  let paquetCollations = melanger(colls, rand);

  const piocherCollation = (exclureCetteJournee: Collation[]): Collation | null => {
    if (paquetCollations.length === 0) {
      if (colls.length === 0) return null;
      paquetCollations = melanger(colls, rand); // le paquet est épuisé : on rebrasse
    }
    // On évite aussi les doublons à l'intérieur d'une même journée
    const dispoIdx = paquetCollations.findIndex((c) => !exclureCetteJournee.includes(c));
    if (dispoIdx === -1) return null;
    return paquetCollations.splice(dispoIdx, 1)[0];
  };

  const jours: JourMenu[] = JOURS.map((jour, i) => {
    const repas = [
      { moment: "Déjeuner", r: idx(dej, PATRONS.dej[i]) },
      { moment: "Dîner", r: idx(din, PATRONS.din[i]) },
      { moment: "Souper", r: idx(soup, PATRONS.soup[i]) },
    ];
    let k = repas.reduce((s, m) => s + m.r.k, 0) * portionsRepas;
    let p = repas.reduce((s, m) => s + m.r.p, 0) * portionsRepas;
    // Le nombre de collations choisi par le profil est toujours respecté (quitte à
    // dépasser légèrement la cible calorique certains jours) — seul un manque de
    // collations disponibles dans la banque filtrée peut réduire ce nombre.
    const snacks: Collation[] = [];
    for (let n = 0; n < pr.collations; n++) {
      const choix = piocherCollation(snacks);
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
