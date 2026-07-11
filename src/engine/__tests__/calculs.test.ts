import { describe, expect, it } from "vitest";
import { calculerCibles } from "../calculs";
import type { Profil } from "../types";

const DEMO: Profil = {
  age: 44, sexe: "F", lb: 150, pi: 5, po: 6,
  act: "sedentaire", freq: 4, duree: 40, marche: 30,
  objectif: "perte", rythme: 0.75, regime: "vegetarien",
  allergies: [], collations: 2, medical: false,
};

describe("calculerCibles", () => {
  it("calcule le BMR Mifflin-St Jeor du profil démo (~1347 kcal)", () => {
    const c = calculerCibles(DEMO);
    expect(c.bmr).toBeGreaterThan(1340);
    expect(c.bmr).toBeLessThan(1355);
  });

  it("estime un NAF de 1,45 (sédentaire + 4 entraînements + marche 30 min)", () => {
    expect(calculerCibles(DEMO).naf).toBeCloseTo(1.45, 2);
  });

  it("place la cible calorique dans une fourchette de perte progressive", () => {
    const c = calculerCibles(DEMO);
    expect(c.kcal).toBeGreaterThan(1500);
    expect(c.kcal).toBeLessThan(1750);
    expect(c.tdee - c.kcal).toBeCloseTo(0.75 * 500, 0);
  });

  it("vise ~1,7 g/kg de protéines en perte + musculation (~115 g)", () => {
    const c = calculerCibles(DEMO);
    expect(c.prot).toBeCloseTo(c.kg * 1.7, 1);
    expect(Math.round(c.prot)).toBeGreaterThanOrEqual(110);
    expect(Math.round(c.prot)).toBeLessThanOrEqual(120);
  });

  it("applique le plancher de sécurité (jamais sous 1400 kcal pour une femme)", () => {
    const petite: Profil = { ...DEMO, lb: 105, pi: 5, po: 0, freq: 0, marche: 0, rythme: 1 };
    const c = calculerCibles(petite);
    expect(c.kcal).toBeGreaterThanOrEqual(1400);
    expect(c.kcal).toBeGreaterThanOrEqual(c.bmr * 0.95);
  });

  it("plafonne le rythme de perte à 1 lb/semaine", () => {
    const extreme = calculerCibles({ ...DEMO, rythme: 3 });
    expect(extreme.tdee - extreme.kcal).toBeLessThanOrEqual(500);
  });

  it("majore les protéines de 10 % en régime végétalien", () => {
    const vg = calculerCibles({ ...DEMO, regime: "vegetalien" });
    const base = calculerCibles(DEMO);
    expect(vg.prot / base.prot).toBeCloseTo(1.1, 2);
  });

  it("force le maintien (aucun déficit) en mode médical", () => {
    const c = calculerCibles({ ...DEMO, medical: true });
    expect(c.objectif).toBe("maintien");
    expect(c.kcal).toBeCloseTo(c.tdee, 5);
  });
});
