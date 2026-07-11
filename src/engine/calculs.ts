import type { Cibles, Profil } from "./types";

/**
 * Cibles nutritionnelles à partir du profil.
 * - BMR : Mifflin-St Jeor
 * - NAF dérivé de l'activité déclarée (travail + entraînements + marche)
 * - Déficit plafonné (rythme ≤ 1 lb/sem) et plancher de sécurité
 * - Mode médical : aucun déficit (maintien forcé)
 */
export function calculerCibles(pr: Profil): Cibles {
  const kg = pr.lb * 0.4536;
  const cm = pr.pi * 30.48 + pr.po * 2.54;
  const bmr = pr.sexe === "H"
    ? 10 * kg + 6.25 * cm - 5 * pr.age + 5
    : 10 * kg + 6.25 * cm - 5 * pr.age - 161;

  let naf = 1.2
    + 0.05 * Math.min(pr.freq, 5)
    + (pr.marche >= 30 ? 0.05 : 0)
    + (pr.act === "actif" ? 0.15 : pr.act === "leger" ? 0.05 : 0);
  naf = Math.min(naf, 1.8);

  const tdee = bmr * naf;
  const objectif = pr.medical ? "maintien" : pr.objectif;

  let kcal = tdee;
  if (objectif === "perte") {
    const rythme = Math.min(pr.rythme, 1);
    const plancher = Math.max(pr.sexe === "H" ? 1600 : 1400, bmr * 0.95);
    kcal = Math.max(tdee - rythme * 500, plancher);
  } else if (objectif === "masse") {
    kcal = tdee + 275;
  }

  let protKg = objectif === "masse" ? 1.8 : objectif === "perte" && pr.freq >= 3 ? 1.7 : 1.5;
  if (pr.regime === "vegetalien") protKg *= 1.1;
  const prot = kg * protKg;

  const lip = (kcal * 0.3) / 9;
  const fibres = Math.max(25, (kcal * 14) / 1000);
  const gluc = Math.max(0, (kcal - prot * 4 - lip * 9) / 4);

  return { kg, cm, bmr, naf, tdee, kcal, prot, lip, gluc, fibres, objectif };
}
