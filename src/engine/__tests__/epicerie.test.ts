import { describe, expect, it } from "vitest";
import { listeEpicerie } from "../epicerie";
import type { MenuGenere } from "../types";

const menu = (compte: Record<string, number>, portionsRepas = 1): MenuGenere => ({ jours: [], compte, portionsRepas });

describe("listeEpicerie", () => {
  it("multiplie les quantités par le nombre de portions (4× gruau → 160 g d'avoine)", () => {
    const l = listeEpicerie(menu({ d1: 4 }));
    const avoine = l.C?.find((i) => i.nom.includes("avoine"));
    expect(avoine?.q).toBe(160);
    const yogourt = l.D?.find((i) => i.nom.includes("Yogourt"));
    expect(yogourt?.q).toBe(700);
  });

  it("consolide un même ingrédient utilisé par plusieurs recettes", () => {
    // Yogourt grec : gruau (175 g) ×2 + chili (60 g) ×2 = 470 g
    const l = listeEpicerie(menu({ d1: 2, s1: 2 }));
    const yogourt = l.D?.filter((i) => i.nom.includes("Yogourt"));
    expect(yogourt).toHaveLength(1);
    expect(yogourt![0].q).toBe(470);
  });

  it("suit le facteur de portions du profil pour les recettes, pas pour les collations", () => {
    const l = listeEpicerie(menu({ d1: 4, "coll-yogourt-grec-et-bleuets": 2 }, 1.5));
    expect(l.C?.find((i) => i.nom.includes("avoine"))?.q).toBe(240); // 40 × 4 × 1,5
    // coll-yogourt-grec-et-bleuets : yogourt 175 × 2 = 350, PAS ×1,5 ; d1 en ajoute 175 × 4 × 1,5 = 1050 → 1400
    expect(l.D?.find((i) => i.nom.includes("Yogourt grec"))?.q).toBe(1400);
  });

  it("arrondit les grammes au 5 g et les unités au 0,5 supérieur", () => {
    const l = listeEpicerie(menu({ d1: 1 }));
    expect(l.N?.find((i) => i.nom.includes("Lin"))?.q).toBe(10); // 7 g → 10 g
    const l2 = listeEpicerie(menu({ d2: 1 }));
    expect(l2.F?.find((i) => i.nom === "Avocat")?.q).toBe(0.5); // 0,25 → 0,5
  });
});
