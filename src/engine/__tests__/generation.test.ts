import { describe, expect, it } from "vitest";
import { calculerCibles } from "../calculs";
import { genererMenu } from "../generation";
import { estErreur, type Profil, type Recette } from "../types";
import { ALLERGENES } from "../filtrage";
import { RECETTES } from "../data/recettes";
import { COLLATIONS } from "../data/collations";

const DEMO: Profil = {
  age: 44, sexe: "F", lb: 150, pi: 5, po: 6,
  act: "sedentaire", freq: 4, duree: 40, marche: 30,
  objectif: "perte", rythme: 0.75, regime: "vegetarien",
  allergies: [], collations: 2, medical: false,
};

describe("genererMenu", () => {
  const cibles = calculerCibles(DEMO);

  it("produit 7 jours de 3 repas + collations ≤ paramètre", () => {
    const m = genererMenu(DEMO, cibles, 1);
    if (estErreur(m)) throw new Error(m.erreur);
    expect(m.jours).toHaveLength(7);
    m.jours.forEach((j) => {
      expect(j.repas).toHaveLength(3);
      expect(j.snacks.length).toBeLessThanOrEqual(DEMO.collations);
    });
  });

  it("sert le nombre de collations demandé chaque jour (pas seulement en moyenne)", () => {
    const m = genererMenu(DEMO, cibles, 1);
    if (estErreur(m)) throw new Error(m.erreur);
    m.jours.forEach((j) => expect(j.snacks).toHaveLength(DEMO.collations));
  });

  it("reste proche de la cible calorique (±20 % chaque jour)", () => {
    // Tolérance élargie vs l'ancienne version : le nombre de collations choisi
    // par le profil est maintenant toujours respecté (cf. genererMenu), quitte
    // à dépasser un peu la cible calorique les jours à repas plus lourds.
    const m = genererMenu(DEMO, cibles, 1);
    if (estErreur(m)) throw new Error(m.erreur);
    m.jours.forEach((j) => {
      expect(Math.abs(j.k - cibles.kcal) / cibles.kcal).toBeLessThan(0.2);
    });
  });

  it("est déterministe : même seed → même menu", () => {
    const a = genererMenu(DEMO, cibles, 42);
    const b = genererMenu(DEMO, cibles, 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("varie avec la seed (régénération)", () => {
    const ids = new Set(
      [1, 2, 3, 4, 5].map((s) => JSON.stringify(Object.keys((genererMenu(DEMO, cibles, s) as any).compte).sort()))
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it("n'inclut jamais un allergène déclaré dans le menu généré", () => {
    const pr: Profil = { ...DEMO, allergies: ["sesame"] };
    const m = genererMenu(pr, calculerCibles(pr), 3);
    if (estErreur(m)) throw new Error(m.erreur);
    const noms = Object.keys(m.compte).flatMap((id) => {
      const r = RECETTES.find((x) => x.id === id) ?? COLLATIONS.find((x) => x.id === id);
      return r ? r.ing.map(([n]) => n.toLowerCase()) : [];
    });
    ALLERGENES.sesame.forEach((kw) => expect(noms.some((n) => n.includes(kw))).toBe(false));
  });

  it("retourne une erreur honnête quand les contraintes vident la banque", () => {
    const pr: Profil = { ...DEMO, regime: "vegetalien", allergies: ["soya"] };
    const m = genererMenu(pr, calculerCibles(pr), 1);
    expect(estErreur(m)).toBe(true);
  });
});

describe("cohérence menu ↔ meal prep", () => {
  it("aucun repas servi avant son jour de cuisson (dimanche < lun, mercredi ≤ mer, vendredi ≤ sam)", async () => {
    const { planPrep } = await import("../prep");
    const interdits = { dimanche: [] as string[], mercredi: ["lun", "mar"], vendredi: ["lun", "mar", "mer", "jeu"] };
    for (const regime of ["vegetarien", "vegetalien"] as const) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const pr: Profil = { ...DEMO, regime };
        const m = genererMenu(pr, calculerCibles(pr), seed);
        if (estErreur(m)) throw new Error(m.erreur);
        const { blocs } = planPrep(m);
        (Object.keys(blocs) as (keyof typeof blocs)[]).forEach((b) =>
          blocs[b].forEach((t) =>
            t.jours.forEach((j) => expect(interdits[b], `${t.r.nom} (${b})`).not.toContain(j))
          )
        );
      }
    }
  });

  it("les recettes « fraîches » ne sont jamais servies en début de semaine", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const m = genererMenu(DEMO, calculerCibles(DEMO), seed);
      if (estErreur(m)) throw new Error(m.erreur);
      m.jours.slice(0, 2).forEach((j) =>
        j.repas.forEach((r) => expect(r.r.moment).not.toBe("frais"))
      );
    }
  });
});

describe("adaptation aux profils (portions à l'échelle)", () => {
  it("un homme en prise de masse (~3000 kcal) reçoit des portions ×2 et un menu proche de SA cible", () => {
    const pr: Profil = { ...DEMO, sexe: "H", age: 30, lb: 190, pi: 5, po: 11, freq: 5, objectif: "masse", regime: "vegetarien" };
    const c = calculerCibles(pr);
    expect(c.kcal).toBeGreaterThan(2700);
    const m = genererMenu(pr, c, 1);
    if (estErreur(m)) throw new Error(m.erreur);
    expect(m.portionsRepas).toBeGreaterThan(1.5);
    m.jours.forEach((j) => expect(Math.abs(j.k - c.kcal) / c.kcal).toBeLessThan(0.15));
  });

  it("une petite personne en perte reçoit des portions réduites (≤ 1)", () => {
    const pr: Profil = { ...DEMO, lb: 110, pi: 5, po: 1, freq: 1, marche: 0, rythme: 1 };
    const m = genererMenu(pr, calculerCibles(pr), 1);
    if (estErreur(m)) throw new Error(m.erreur);
    expect(m.portionsRepas).toBeLessThanOrEqual(1);
  });

  it("le profil démo reste à ×1 (banque calibrée sur ~1650 kcal)", () => {
    const m = genererMenu(DEMO, calculerCibles(DEMO), 1);
    if (estErreur(m)) throw new Error(m.erreur);
    expect(m.portionsRepas).toBe(1);
  });
});

describe("évite les répétitions dîner/souper le même jour", () => {
  const MOTS_SIGNATURE = ["lentille", "tofu", "haricot", "pois chiche", "quinoa", "riz", "orge", "patate douce"];
  const motsSignature = (r: { ing: [string, ...unknown[]][] }) =>
    new Set(MOTS_SIGNATURE.filter((mot) => r.ing.some(([n]) => n.toLowerCase().includes(mot))));
  const partageSignature = (a: { ing: [string, ...unknown[]][] }, b: { ing: [string, ...unknown[]][] }) => {
    const sa = motsSignature(a);
    for (const mot of motsSignature(b)) if (sa.has(mot)) return true;
    return false;
  };

  it("réduit nettement les jours où dîner et souper partagent un ingrédient dominant", () => {
    const cibles = calculerCibles(DEMO);
    let clashes = 0, jours = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const m = genererMenu(DEMO, cibles, seed);
      if (estErreur(m)) throw new Error(m.erreur);
      m.jours.forEach((j) => {
        jours++;
        const din = j.repas.find((r) => r.moment === "Dîner")!.r;
        const soup = j.repas.find((r) => r.moment === "Souper")!.r;
        if (partageSignature(din, soup)) clashes++;
      });
    }
    // Avec la banque MVP (peu de recettes), on ne peut pas garantir 0 collision,
    // mais elles doivent rester nettement minoritaires (< 25 % des jours).
    expect(clashes / jours).toBeLessThan(0.25);
  });
});

describe("sélection influencée par les macros (protéines/fibres)", () => {
  it("choisit en moyenne des recettes plus denses en protéines et en fibres que l'ensemble de la banque filtrée", () => {
    const cibles = calculerCibles(DEMO);
    const dens = (r: { p: number; fb: number; k: number }) => ({ prot: r.p / r.k, fibres: r.fb / r.k });

    const bancPool = RECETTES.filter((r) => r.regimes.includes(DEMO.regime));
    const moyBanque = bancPool.reduce((s, r) => s + dens(r).prot + dens(r).fibres, 0) / bancPool.length;

    const choisies: typeof RECETTES = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = genererMenu(DEMO, cibles, seed);
      if (estErreur(m)) throw new Error(m.erreur);
      m.jours.forEach((j) => j.repas.forEach((rj) => choisies.push(rj.r)));
    }
    const moyChoisies = choisies.reduce((s, r) => s + dens(r).prot + dens(r).fibres, 0) / choisies.length;

    expect(moyChoisies).toBeGreaterThan(moyBanque);
  });
});

describe("sélection influencée par les micronutriments (quand la recette en fournit)", () => {
  it("inclut plus souvent la recette la plus riche en micronutriments parmi 3 déjeuners candidats dont 2 sont retenus", () => {
    const creerRecette = (o: Partial<Recette> & Pick<Recette, "id" | "nom" | "type" | "moment">): Recette => ({
      regimes: ["vegetarien"], k: 400, p: 20, fb: 5, gl: 40, lp: 12,
      micro: 50, prep: 5, cuis: 0, cons: 4, cong: false, tags: [],
      ing: [["Ingrédient", 100, "g", "L"]], et: [],
      ...o,
    });
    const riche = creerRecette({
      id: "riche", nom: "Riche", type: "dej", moment: "dimanche",
      micronutriments: { fer_mg: 20, calcium_mg: 800, zinc_mg: 15, b12_ug: 5, magnesium_mg: 300, potassium_mg: 2000, omega3_g: 3 },
    });
    const pauvre1 = creerRecette({
      id: "pauvre1", nom: "Pauvre 1", type: "dej", moment: "dimanche",
      micronutriments: { fer_mg: 0.1, calcium_mg: 5, zinc_mg: 0.1, b12_ug: 0.01, magnesium_mg: 5, potassium_mg: 20, omega3_g: 0.01 },
    });
    const pauvre2 = creerRecette({
      id: "pauvre2", nom: "Pauvre 2", type: "dej", moment: "dimanche",
      micronutriments: { fer_mg: 0.1, calcium_mg: 5, zinc_mg: 0.1, b12_ug: 0.01, magnesium_mg: 5, potassium_mg: 20, omega3_g: 0.01 },
    });
    const dinFiller = creerRecette({ id: "din1", nom: "Din", type: "din", moment: "misemaine" });
    const soupFiller = creerRecette({ id: "soup1", nom: "Soup", type: "soup", moment: "frais" });
    const recettes = [riche, pauvre1, pauvre2, dinFiller, soupFiller];

    const pr: Profil = { ...DEMO, collations: 0 };
    const cibles = calculerCibles(pr);

    let inclus = 0;
    const NB_SEMAINES = 40;
    for (let seed = 1; seed <= NB_SEMAINES; seed++) {
      const m = genererMenu(pr, cibles, seed, recettes, []);
      if (estErreur(m)) throw new Error(m.erreur);
      if (Object.keys(m.compte).includes("riche")) inclus++;
    }
    // Sans pondération, P(inclusion parmi 2 choisis sur 3) = 2/3 ≈ 0,667 en moyenne.
    expect(inclus / NB_SEMAINES).toBeGreaterThan(0.75);
  });
});
