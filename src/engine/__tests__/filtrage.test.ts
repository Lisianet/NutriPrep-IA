import { describe, expect, it } from "vitest";
import { filtrer, sansAllergenes } from "../filtrage";
import { RECETTES } from "../data/recettes";
import { COLLATIONS } from "../data/collations";

describe("filtrage", () => {
  it("exclut toute recette contenant du soya (tofu, edamame, tempeh, miso, boisson)", () => {
    const ok = filtrer(RECETTES, { regime: "vegetarien", allergies: ["soya"] });
    const noms = ok.flatMap((r) => r.ing.map(([n]) => n.toLowerCase()));
    ["tofu", "soya", "edamame", "tempeh", "miso"].forEach((kw) =>
      expect(noms.some((n) => n.includes(kw))).toBe(false)
    );
    expect(ok.map((r) => r.id)).toContain("l2"); // salade de lentilles : sans soya
  });

  it("ne garde que les recettes végétaliennes en régime végétalien", () => {
    const ok = filtrer(RECETTES, { regime: "vegetalien", allergies: [] });
    expect(ok.every((r) => r.regimes.includes("vegetalien"))).toBe(true);
    expect(ok.map((r) => r.id)).not.toContain("d1"); // yogourt grec
  });

  it("le filtre lactose exclut yogourt, feta, kéfir, cottage et parmesan", () => {
    const colls = filtrer(COLLATIONS, { regime: "vegetarien", allergies: ["lactose"] });
    expect(colls.map((c) => c.id).sort()).toEqual(["c4", "c5", "c6", "c7", "c8"]);
  });

  it("sansAllergenes est insensible à la casse", () => {
    expect(sansAllergenes({ regimes: ["vegetarien"], ing: [["TAHINI pur", 10, "g", "N"]] }, ["sesame"])).toBe(false);
  });
});
