import type { Collation } from "../types";

export const COLLATIONS: Collation[] = [
  { id: "c1", nom: "Kéfir + petits fruits", regimes: ["vegetarien"], k: 150, p: 9, micro: 72, tags: ["fermenté"], ing: [["Kéfir nature", 250, "ml", "D"], ["Petits fruits surgelés", 70, "g", "S"]] },
  { id: "c2", nom: "Yogourt grec + graines de citrouille", regimes: ["vegetarien"], k: 170, p: 19, micro: 66, tags: ["fermenté"], ing: [["Yogourt grec nature 2 %", 175, "g", "D"], ["Graines de citrouille", 10, "g", "N"]] },
  { id: "c3", nom: "Cottage + ananas", regimes: ["vegetarien"], k: 140, p: 14, micro: 55, tags: [], ing: [["Fromage cottage 2 %", 110, "g", "D"], ["Ananas", 80, "g", "F"]] },
  { id: "c4", nom: "Pomme + beurre d'arachide", regimes: ["vegetarien", "vegetalien"], k: 195, p: 5, micro: 62, tags: ["prébiotique"], ing: [["Pomme", 1, "un", "F"], ["Beurre d'arachide naturel", 15, "g", "N"]] },
  { id: "c5", nom: "Edamames en cosses", regimes: ["vegetarien", "vegetalien"], k: 120, p: 11, micro: 68, tags: [], ing: [["Edamames en cosses surgelés", 120, "g", "S"]] },
  { id: "c6", nom: "Houmous + crudités", regimes: ["vegetarien", "vegetalien"], k: 160, p: 6, micro: 74, tags: ["prébiotique"], ing: [["Houmous", 60, "g", "G"], ["Carotte", 1, "un", "L"], ["Céleri", 1, "branche", "L"]] },
  { id: "c7", nom: "Yogourt de soya + granola", regimes: ["vegetarien", "vegetalien"], k: 170, p: 8, micro: 60, tags: ["végétalien"], ing: [["Yogourt de soya nature", 150, "g", "D"], ["Granola faible en sucre", 20, "g", "C"]] },
  { id: "c8", nom: "Boules d'énergie avoine-arachide", regimes: ["vegetarien", "vegetalien"], k: 180, p: 5, micro: 70, tags: ["végétalien", "prébiotique"], ing: [["Flocons d'avoine", 20, "g", "C"], ["Beurre d'arachide naturel", 12, "g", "N"], ["Dattes", 15, "g", "F"], ["Lin moulu", 5, "g", "N"]] },
  { id: "c9", nom: "Smoothie kéfir-mangue", regimes: ["vegetarien"], k: 170, p: 8, micro: 72, tags: ["fermenté"], ing: [["Kéfir nature", 200, "ml", "D"], ["Mangue", 60, "g", "F"]] },
];