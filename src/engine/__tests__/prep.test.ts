import { describe, expect, it } from "vitest";
import { jourPrepParRecette, planPrep, vegetauxDistincts } from "../prep";
import { RECETTES } from "../data/recettes";
import { JOURS, type JourMenu, type MenuGenere } from "../types";

/** Construit un menu minimal : repasParJour[i] = ids servis le jour i. */
const menu = (repasParJour: string[][], compte: Record<string, number> = {}, portionsRepas = 1): MenuGenere => ({
  compte, portionsRepas,
  jours: repasParJour.map((ids, i): JourMenu => ({
    jour: JOURS[i],
    repas: ids.map((id) => ({ moment: "Repas", r: RECETTES.find((r) => r.id === id)! })),
    snacks: [], k: 0, p: 0, fb: 0, micro: 0,
  })),
});

describe("planPrep", () => {
  it("rattache chaque lot au bloc de cuisson qui précède sa PREMIÈRE consommation", () => {
    // d1 servi lun/mar/mer → dimanche ; s2 servi mer/jeu → mercredi ; s3 servi sam/dim → vendredi
    const m = menu([["d1"], ["d1"], ["d1", "s2"], ["s2"], [], ["s3"], ["s3"]]);
    const { blocs } = planPrep(m);
    expect(blocs.dimanche.map((t) => t.r.id)).toEqual(["d1"]);
    expect(blocs.mercredi.map((t) => t.r.id)).toEqual(["s2"]);
    expect(blocs.vendredi.map((t) => t.r.id)).toEqual(["s3"]);
  });

  it("liste les jours de consommation et le nombre de portions de chaque lot", () => {
    const m = menu([["d1"], ["d1"], [], ["d1"], [], [], []]);
    const t = planPrep(m).blocs.dimanche[0];
    expect(t.n).toBe(3);
    expect(t.jours).toEqual(["lun", "mar", "jeu"]);
  });

  it("trie par durée décroissante et estime la parallélisation (facteur 0,6)", () => {
    const m = menu([["d1", "s1"], [], [], [], [], [], []]); // 10 min et 50 min, tous deux dimanche
    const { blocs, duree } = planPrep(m);
    expect(blocs.dimanche[0].r.id).toBe("s1");
    expect(duree(blocs.dimanche)).toBe(Math.round((50 + 10) * 0.6));
  });

  it("jourPrepParRecette expose le jour de cuisson pour les badges du menu", () => {
    const m = menu([["d1"], [], ["s2"], [], [], ["s3"], []]);
    expect(jourPrepParRecette(m)).toEqual({ d1: "dimanche", s2: "mercredi", s3: "vendredi" });
  });

  it("met les portions à cuisiner à l'échelle du profil (3 usages × 1,5 = 4,5 portions)", () => {
    const m = menu([["d1"], ["d1"], [], ["d1"], [], [], []], {}, 1.5);
    expect(planPrep(m).blocs.dimanche[0].n).toBe(4.5);
  });

  it("compte les végétaux distincts de la semaine (depuis compte)", () => {
    expect(vegetauxDistincts(menu([], { d1: 4 }))).toBe(3); // avoine, chia, lin
  });
});
