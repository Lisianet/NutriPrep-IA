import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ALLERG_LABELS, CAT_NOMS, COLLATIONS,
  calculerCibles, estErreur, genererMenu, jourPrepParRecette, listeEpicerie, planPrep, vegetauxDistincts,
  type Allergene, type Cat, type Cibles, type Collation, type JourPrep, type MenuGenere, type Profil, type Recette, type TachePrep,
} from "./engine";
import { chargerRecettes } from "./lib/chargerRecettes";

const T = {
  bg: "#EDF3ED", ink: "#17271E", sub: "#5A6E60", card: "#FFFFFF",
  line: "#D6E2D6", green: "#2E7D4F", greenDark: "#1F5A38", greenSoft: "#E1EFE3",
  curcuma: "#D99A2B", curcumaSoft: "#F7EBD3", berry: "#B34A66", berrySoft: "#F5E3E8",
};
const FONT_D = "'Fraunces', Georgia, serif";
const FONT_B = "'Work Sans', system-ui, sans-serif";
const fr = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");

/* ---------- UI de base ---------- */
const Card = ({ children, style, pad = 20 }: { children: ReactNode; style?: CSSProperties; pad?: number }) => (
  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: pad, ...style }}>{children}</div>
);
const Etiquette = ({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "curcuma" | "berry" }) => {
  const m = { green: [T.greenSoft, T.greenDark], curcuma: [T.curcumaSoft, "#8A5E10"], berry: [T.berrySoft, T.berry] }[tone];
  return <span style={{ background: m[0], color: m[1], fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>{children}</span>;
};

/** Badge « quand ce plat est-il cuisiné ? » — remplace les anciennes pastilles de couleur. */
const PREP_INFO: Record<JourPrep, { label: string; tone: "green" | "curcuma" | "berry" }> = {
  dimanche: { label: "cuisiné dim.", tone: "green" },
  mercredi: { label: "cuisiné mer.", tone: "curcuma" },
  vendredi: { label: "cuisiné frais", tone: "berry" },
};
const PrepBadge = ({ b }: { b?: JourPrep }) => b ? <Etiquette tone={PREP_INFO[b].tone}>{PREP_INFO[b].label}</Etiquette> : null;

const Anneau = ({ val, label }: { val: number; label: string }) => {
  const r = 36, c = 2 * Math.PI * r, pct = Math.min(val, 100) / 100;
  const couleur = val >= 75 ? T.green : val >= 50 ? T.curcuma : T.sub;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={92} height={92} viewBox="0 0 92 92" role="img" aria-label={`${label} : ${val} sur 100`}>
        <circle cx="46" cy="46" r={r} fill="none" stroke={T.line} strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={couleur} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 46 46)" />
        <text x="46" y="52" textAnchor="middle" style={{ fontFamily: FONT_D, fontSize: 24, fontWeight: 600, fill: T.ink }}>{val}</text>
      </svg>
      <span style={{ fontSize: 12, color: T.sub, fontWeight: 500 }}>{label}</span>
    </div>
  );
};
const Bouton = ({ children, onClick, ghost, small, disabled }: { children: ReactNode; onClick?: () => void; ghost?: boolean; small?: boolean; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled} style={{
    fontFamily: FONT_B, fontWeight: 600, fontSize: small ? 13 : 15, cursor: disabled ? "not-allowed" : "pointer",
    padding: small ? "8px 14px" : "12px 22px", borderRadius: 10,
    background: ghost ? "transparent" : T.green, color: ghost ? T.greenDark : "#fff",
    border: ghost ? `1.5px solid ${T.green}` : "1.5px solid transparent", opacity: disabled ? 0.5 : 1,
  }}>{children}</button>
);
const Champ = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}{children}</label>
);
const inputStyle: CSSProperties = { fontFamily: FONT_B, fontSize: 15, padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${T.line}`, background: "#FBFDFA", color: T.ink, width: "100%", boxSizing: "border-box" };

/** Nom de recette cliquable — ouvre la fiche complète. */
const NomRecette = ({ nom, onClick, gras = true }: { nom: string; onClick: () => void; gras?: boolean }) => (
  <button onClick={onClick} title="Voir la recette" style={{
    all: "unset", cursor: "pointer", fontFamily: FONT_B, fontSize: "inherit", fontWeight: gras ? 600 : 500,
    color: T.ink, textDecoration: "underline", textDecorationColor: "#A9C4AE", textDecorationThickness: 1.5, textUnderlineOffset: 3,
  }}>{nom}</button>
);

/* ---------- Fiche recette (modale) ---------- */
type Detail = { r: Recette; collation?: false } | { r: Collation; collation: true };

function FicheRecette({ d, portionsDefaut, onClose }: { d: Detail; portionsDefaut: number; onClose: () => void }) {
  const [portions, setPortions] = useState(portionsDefaut);
  // v4 : les ingrédients indivisibles (œufs, tortillas, pains, fruits entiers...)
  // sont arrondis à l'unité entière (minimum 1) plutôt que divisés — jamais 1,25 œuf.
  const fmt = (q: number, indivisible?: boolean) =>
    fr(indivisible ? Math.max(1, Math.round(q * portions)) : q * portions);
  const r = d.r;
  const recette = !d.collation ? (r as Recette) : null;
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={r.nom}
      style={{ position: "fixed", inset: 0, background: "rgba(23,39,30,.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 16, maxWidth: 660, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24, fontFamily: FONT_B, color: T.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <h3 style={{ fontFamily: FONT_D, fontSize: 24, margin: 0, lineHeight: 1.2 }}>{r.nom}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ all: "unset", cursor: "pointer", fontSize: 22, color: T.sub, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>
          {r.k} kcal · {r.p} g prot{recette ? <> · {recette.fb} g fibres · prêt en {recette.prep + recette.cuis} min · frigo {recette.cons} j{recette.cong ? " · congelable" : ""}</> : <> · assemblage, aucune cuisson</>}
          {" "}<span style={{ color: "#8FA697" }}>(par portion)</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <Etiquette tone={r.micro >= 80 ? "green" : "curcuma"}>Microbiote {r.micro}/100</Etiquette>
          {r.tags.map((t) => <Etiquette key={t} tone="berry">{t}</Etiquette>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Portions :</span>
          {[0.75, 1, 1.25, 1.5, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => setPortions(n)} style={{ fontFamily: FONT_B, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontWeight: 600, fontSize: 13, border: `1.5px solid ${portions === n ? T.green : T.line}`, background: portions === n ? T.greenSoft : "#fff", color: portions === n ? T.greenDark : T.sub }}>×{fr(n)}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: recette ? "1fr 1fr" : "1fr", gap: 18 }}>
          <div>
            <strong style={{ fontSize: 13 }}>Ingrédients {portions !== 1 && <span style={{ color: T.sub, fontWeight: 500 }}>(×{fr(portions)})</span>}</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 13.5, lineHeight: 1.9 }}>
              {r.ing.map(([nom, q, u, , indiv]) => <li key={nom}>{fmt(q, indiv)} {u} — {nom}</li>)}
            </ul>
          </div>
          {recette && (
            <div>
              <strong style={{ fontSize: 13 }}>Méthode</strong>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
                {recette.et.map((e, i) => <li key={i} style={{ marginBottom: 6 }}>{e}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Profils ---------- */
const PROFIL_DEMO: Profil = { age: 44, sexe: "F", lb: 150, pi: 5, po: 6, act: "sedentaire", freq: 4, duree: 40, marche: 30, objectif: "perte", rythme: 0.75, regime: "vegetarien", allergies: [], collations: 2, medical: false };
const PROFIL_VIDE: Profil = { age: 0, sexe: "F", lb: 0, pi: 5, po: 6, act: "sedentaire", freq: 3, duree: 40, marche: 30, objectif: "perte", rythme: 0.5, regime: "vegetarien", allergies: [], collations: 2, medical: false };

/* ---------- Écrans ---------- */
function Accueil({ demarrer, demo }: { demarrer: () => void; demo: () => void }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, color: T.green, textTransform: "uppercase" }}>Prototype MVP</div>
      <h1 style={{ fontFamily: FONT_D, fontSize: "clamp(34px, 6vw, 54px)", fontWeight: 600, margin: "12px 0 16px", lineHeight: 1.1 }}>
        Une semaine de repas,<br />calculée pour <em style={{ color: T.green }}>vous</em>.
      </h1>
      <p style={{ color: T.sub, fontSize: 17, lineHeight: 1.6, maxWidth: 540, margin: "0 auto 28px" }}>
        Profil → besoins nutritionnels → menu 7 jours en mode meal prep, aux portions adaptées à vos objectifs,
        avec recettes détaillées, plan de préparation cohérent et liste d'épicerie consolidée.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Bouton onClick={demarrer}>Créer mon profil</Bouton>
        <Bouton ghost onClick={demo}>Essayer avec le profil démo</Bouton>
      </div>
      <Card style={{ marginTop: 40, textAlign: "left", background: T.curcumaSoft, borderColor: "#E8D3A4" }}>
        <strong style={{ fontSize: 13 }}>⚕️ Avertissement</strong>
        <p style={{ fontSize: 13, color: "#6B5312", margin: "6px 0 0", lineHeight: 1.55 }}>
          Les recommandations de NutriPrep IA sont informatives et ne remplacent pas l'avis d'un médecin,
          nutritionniste ou diététiste — particulièrement en cas de condition médicale, trouble alimentaire,
          grossesse, médication, diabète, maladie rénale ou digestive.
        </p>
      </Card>
    </div>
  );
}

function Questionnaire({ pr, setPr, valider }: { pr: Profil; setPr: (p: Profil) => void; valider: () => void }) {
  const [etape, setEtape] = useState(0);
  const maj = (k: keyof Profil, v: unknown) => setPr({ ...pr, [k]: v });
  const Radio = ({ champ, options }: { champ: keyof Profil; options: [unknown, string][] }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(([v, lab]) => (
        <button key={lab} onClick={() => maj(champ, v)} style={{
          fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 9, cursor: "pointer",
          border: `1.5px solid ${pr[champ] === v ? T.green : T.line}`,
          background: pr[champ] === v ? T.greenSoft : "#fff", color: pr[champ] === v ? T.greenDark : T.sub,
        }}>{lab}</button>
      ))}
    </div>
  );
  const etapes = [
    { titre: "Données de base", ok: pr.age >= 18 && pr.lb >= 80, contenu: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Champ label="Âge"><input style={inputStyle} type="number" value={pr.age || ""} onChange={(e) => maj("age", +e.target.value)} /></Champ>
        <Champ label="Sexe (formule de calcul)"><Radio champ="sexe" options={[["F", "Femme"], ["H", "Homme"]]} /></Champ>
        <Champ label="Poids (lb)"><input style={inputStyle} type="number" value={pr.lb || ""} onChange={(e) => maj("lb", +e.target.value)} /></Champ>
        <Champ label="Taille (pieds · pouces)">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} type="number" value={pr.pi} onChange={(e) => maj("pi", +e.target.value)} aria-label="pieds" />
            <input style={inputStyle} type="number" value={pr.po} onChange={(e) => maj("po", +e.target.value)} aria-label="pouces" />
          </div>
        </Champ>
        {pr.age > 0 && pr.age < 18 && <p style={{ gridColumn: "1/-1", fontSize: 13, color: T.berry, margin: 0 }}>NutriPrep IA s'adresse aux adultes. Pour les moins de 18 ans, consultez un(e) professionnel(le) de la santé.</p>}
      </div>) },
    { titre: "Activité", ok: true, contenu: (
      <div style={{ display: "grid", gap: 16 }}>
        <Champ label="Activité quotidienne (travail)"><Radio champ="act" options={[["sedentaire", "Sédentaire"], ["leger", "Légère"], ["actif", "Active"]]} /></Champ>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Champ label="Entraînements / sem."><input style={inputStyle} type="number" min={0} max={7} value={pr.freq} onChange={(e) => maj("freq", +e.target.value)} /></Champ>
          <Champ label="Durée (min)"><input style={inputStyle} type="number" value={pr.duree} onChange={(e) => maj("duree", +e.target.value)} /></Champ>
          <Champ label="Marche (min/jour)"><input style={inputStyle} type="number" value={pr.marche} onChange={(e) => maj("marche", +e.target.value)} /></Champ>
        </div>
      </div>) },
    { titre: "Objectif", ok: true, contenu: (
      <div style={{ display: "grid", gap: 16 }}>
        <Champ label="Objectif principal"><Radio champ="objectif" options={[["perte", "Perte progressive"], ["maintien", "Maintien"], ["masse", "Prise de masse"]]} /></Champ>
        {pr.objectif === "perte" && <Champ label="Rythme visé (plafonné à 1 lb/sem — sécuritaire et durable)">
          <Radio champ="rythme" options={[[0.5, "0,5 lb/sem"], [0.75, "0,75 lb/sem"], [1, "1 lb/sem"]]} /></Champ>}
        <Champ label="Condition médicale, grossesse ou trouble alimentaire ?">
          <Radio champ="medical" options={[[false, "Non"], [true, "Oui"]]} /></Champ>
        {pr.medical && <Card pad={14} style={{ background: T.berrySoft, borderColor: "#E4C2CC" }}>
          <p style={{ fontSize: 13, color: T.berry, margin: 0, lineHeight: 1.5 }}>
            L'application passe en <strong>mode information générale</strong> : aucun déficit calorique ne sera proposé.
            Consultez un(e) professionnel(le) pour un plan adapté à votre situation.</p></Card>}
      </div>) },
    { titre: "Alimentation & logistique", ok: true, contenu: (
      <div style={{ display: "grid", gap: 16 }}>
        <Champ label="Type d'alimentation"><Radio champ="regime" options={[["vegetarien", "Végétarien"], ["vegetalien", "Végétalien"], ["omnivore", "Omnivore"]]} /></Champ>
        <Champ label="Allergies et intolérances (filtre strict)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.entries(ALLERG_LABELS) as [Allergene, string][]).map(([k, lab]) => {
              const actif = pr.allergies.includes(k);
              return <button key={k} onClick={() => maj("allergies", actif ? pr.allergies.filter((a) => a !== k) : [...pr.allergies, k])}
                style={{ fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 9, cursor: "pointer", border: `1.5px solid ${actif ? T.berry : T.line}`, background: actif ? T.berrySoft : "#fff", color: actif ? T.berry : T.sub }}>{lab}</button>;
            })}
          </div></Champ>
        <Champ label="Collations par jour"><Radio champ="collations" options={[[0, "0"], [1, "1"], [2, "2"], [3, "3"]]} /></Champ>
      </div>) },
  ];
  const e = etapes[etape];
  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }} aria-hidden>
        {etapes.map((_, i) => <div key={i} style={{ height: 5, flex: 1, borderRadius: 99, background: i <= etape ? T.green : T.line }} />)}
      </div>
      <Card pad={26}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.green, letterSpacing: 1.5, textTransform: "uppercase" }}>Étape {etape + 1} / {etapes.length}</div>
        <h2 style={{ fontFamily: FONT_D, fontSize: 26, margin: "6px 0 20px" }}>{e.titre}</h2>
        {e.contenu}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
          <Bouton ghost small onClick={() => setEtape(Math.max(0, etape - 1))} disabled={etape === 0}>← Retour</Bouton>
          {etape < etapes.length - 1
            ? <Bouton small onClick={() => setEtape(etape + 1)} disabled={!e.ok}>Continuer →</Bouton>
            : <Bouton small onClick={valider} disabled={!etapes.every((x) => x.ok)}>Générer mon plan ✓</Bouton>}
        </div>
      </Card>
    </div>
  );
}

function TableauDeBord({ cibles, menu, pr, recettes }: { cibles: Cibles; menu: MenuGenere; pr: Profil; recettes: Recette[] }) {
  const moyMicro = Math.round(menu.jours.reduce((s, j) => s + j.micro, 0) / 7);
  const veg = vegetauxDistincts(menu, recettes, COLLATIONS);
  const { blocs, duree } = planPrep(menu, recettes);
  const totalPrep = duree(blocs.dimanche) + duree(blocs.mercredi) + duree(blocs.vendredi);
  const Stat = ({ n, u, lab }: { n: string | number; u: string; lab: string }) => (
    <Card pad={16} style={{ textAlign: "center" }}>
      <div style={{ fontFamily: FONT_D, fontSize: 30, fontWeight: 600 }}>{n}<span style={{ fontSize: 15, color: T.sub, fontWeight: 400 }}> {u}</span></div>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 500 }}>{lab}</div>
    </Card>
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {pr.medical && <Card pad={14} style={{ background: T.berrySoft, borderColor: "#E4C2CC" }}>
        <span style={{ fontSize: 13, color: T.berry }}>Mode information générale actif : cibles au niveau de maintien, sans déficit.</span></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Stat n={Math.round(cibles.kcal)} u="kcal" lab="Cible quotidienne" />
        <Stat n={Math.round(cibles.prot)} u="g" lab="Protéines" />
        <Stat n={Math.round(cibles.fibres)} u="g" lab="Fibres" />
        <Stat n={Math.round(cibles.lip)} u="g" lab="Lipides" />
        <Stat n={`×${fr(menu.portionsRepas)}`} u="" lab="Portion par repas, adaptée à vos besoins" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Card style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "center" }}>
          <Anneau val={moyMicro} label="Microbiote moyen /100" />
          <Anneau val={Math.min(100, Math.round((veg / 30) * 100))} label={`${veg}/30 végétaux distincts`} />
        </Card>
        <Card>
          <strong style={{ fontSize: 14 }}>Hypothèses de calcul</strong>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: T.sub, lineHeight: 1.8 }}>
            <li>Métabolisme de base (Mifflin-St Jeor) : <strong style={{ color: T.ink }}>{Math.round(cibles.bmr)} kcal</strong></li>
            <li>Facteur d'activité estimé : <strong style={{ color: T.ink }}>{cibles.naf.toFixed(2)}</strong></li>
            <li>Dépense totale estimée : <strong style={{ color: T.ink }}>{Math.round(cibles.tdee)} kcal</strong> (±10 %)</li>
            <li>Temps de préparation hebdo estimé : <strong style={{ color: T.ink }}>≈ {totalPrep} min</strong></li>
          </ul>
          <p style={{ fontSize: 12, color: T.sub, margin: "10px 0 0" }}>Ajustez de ±100 kcal après 2–3 semaines selon vos résultats réels.</p>
        </Card>
      </div>
    </div>
  );
}

function VueMenu({ menu, cibles, regenerer, ouvrir, recettes }: { menu: MenuGenere; cibles: Cibles; regenerer: () => void; ouvrir: (d: Detail) => void; recettes: Recette[] }) {
  const prepDe = jourPrepParRecette(menu, recettes);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <p style={{ fontSize: 13.5, color: T.sub, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
          Chaque plat indique <strong>quand il est cuisiné</strong> : <Etiquette tone="green">cuisiné dim.</Etiquette> au bloc du dimanche,{" "}
          <Etiquette tone="curcuma">cuisiné mer.</Etiquette> au mini-bloc du mercredi soir, <Etiquette tone="berry">cuisiné frais</Etiquette> en fin de semaine.
          Un plat n'est jamais servi avant sa préparation. Cliquez sur un nom pour voir la recette.
          {menu.portionsRepas !== 1 && <> Portions ajustées à vos besoins : <strong>×{fr(menu.portionsRepas)}</strong> par repas.</>}
        </p>
        <Bouton ghost small onClick={regenerer}>↻ Régénérer le menu</Bouton>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {menu.jours.map((j) => {
          const ecart = j.k - cibles.kcal;
          return (
            <Card key={j.jour} pad={16}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <strong style={{ fontFamily: FONT_D, fontSize: 17 }}>{j.jour}</strong>
                <div style={{ fontSize: 12.5, color: T.sub }}>
                  {j.k} kcal <span style={{ color: Math.abs(ecart) <= cibles.kcal * 0.07 ? T.green : T.curcuma }}>({ecart > 0 ? "+" : ""}{Math.round(ecart)})</span> · {j.p} g prot · {j.fb} g fibres · <Etiquette tone={j.micro >= 75 ? "green" : "curcuma"}>micro {j.micro}</Etiquette>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {j.repas.map((m) => (
                  <div key={m.moment} style={{ background: "#F7FAF6", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: T.sub, textTransform: "uppercase" }}>{m.moment}</span>
                      <PrepBadge b={prepDe[m.r.id]} />
                    </div>
                    <div style={{ fontSize: 13.5, marginTop: 5 }}>
                      <NomRecette nom={m.r.nom} onClick={() => ouvrir({ r: m.r })} />
                      {menu.portionsRepas !== 1 && <span style={{ color: T.sub, fontSize: 12 }}> ×{fr(menu.portionsRepas)}</span>}
                    </div>
                  </div>
                ))}
                {j.snacks.map((c, i) => (
                  <div key={i} style={{ background: "#fff", border: `1px dashed ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: T.curcuma, textTransform: "uppercase" }}>Collation</div>
                    <div style={{ fontSize: 13.5, marginTop: 5 }}>
                      <NomRecette nom={c.nom} gras={false} onClick={() => ouvrir({ r: c, collation: true })} />{" "}
                      <span style={{ color: T.sub, fontSize: 12 }}>({c.k} kcal · {c.p} g prot)</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Prend "recettes" en prop (chargées depuis Supabase). Les collations restent
 *  statiques (data/collations.ts). v4 : n'affiche plus la banque complète —
 *  seulement les repas ET les collations effectivement utilisés cette semaine. */
function VueRecettes({ menu, ouvrir, recettes }: { menu: MenuGenere; ouvrir: (d: Detail) => void; recettes: Recette[] }) {
  const prepDe = jourPrepParRecette(menu, recettes);
  const usage: Record<string, string[]> = {};
  const ABBR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  menu.jours.forEach((j, i) => j.repas.forEach((m) => (usage[m.r.id] ??= []).push(ABBR[i])));
  const semaine = Object.keys(usage).map((id) => recettes.find((r) => r.id === id)).filter((r): r is Recette => !!r);

  const usageColl: Record<string, string[]> = {};
  menu.jours.forEach((j, i) => j.snacks.forEach((c) => (usageColl[c.id] ??= []).push(ABBR[i])));
  const collationsSemaine = Object.keys(usageColl)
    .map((id) => COLLATIONS.find((c) => c.id === id))
    .filter((c): c is Collation => !!c);

  const Ligne = ({ r, extra }: { r: Recette; extra?: ReactNode }) => (
    <Card pad={14}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontSize: 15 }}><NomRecette nom={r.nom} onClick={() => ouvrir({ r })} /></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{extra}<Etiquette tone={r.micro >= 80 ? "green" : "curcuma"}>micro {r.micro}</Etiquette></div>
      </div>
      <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>{r.k} kcal · {r.p} g prot · {r.fb} g fibres · {r.prep + r.cuis} min · frigo {r.cons} j{r.cong ? " · congelable" : ""}</div>
    </Card>
  );
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13.5, color: T.sub, margin: 0 }}>Cliquez sur un nom pour ouvrir la fiche complète (ingrédients, quantités ajustables, méthode).</p>
      <h3 style={{ fontFamily: FONT_D, fontSize: 20, margin: "4px 0 0" }}>Cette semaine ({semaine.length})</h3>
      {semaine.map((r) => (
        <Ligne key={r.id} r={r} extra={<><PrepBadge b={prepDe[r.id]} /><Etiquette tone="berry">servi {usage[r.id].join(" · ")}</Etiquette></>} />
      ))}
      {collationsSemaine.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13, color: T.greenDark, textTransform: "uppercase", letterSpacing: 1 }}>
            Collations cette semaine ({collationsSemaine.length})
          </strong>
          {collationsSemaine.map((c) => (
            <Card key={c.id} pad={14}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15 }}>
                  <NomRecette nom={c.nom} gras={false} onClick={() => ouvrir({ r: c, collation: true })} />
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Etiquette tone="berry">servi {usageColl[c.id].join(" · ")}</Etiquette>
                  <span style={{ fontSize: 12.5, color: T.sub }}>{c.k} kcal · {c.p} g prot</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VuePrep({ menu, ouvrir, recettes }: { menu: MenuGenere; ouvrir: (d: Detail) => void; recettes: Recette[] }) {
  const { blocs, duree } = planPrep(menu, recettes);
  const Bloc = ({ titre, sousTitre, liste, tone }: { titre: string; sousTitre: string; liste: TachePrep[]; tone: "green" | "curcuma" | "berry" }) => !liste.length ? null : (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <strong style={{ fontFamily: FONT_D, fontSize: 18 }}>{titre}</strong>
        <Etiquette tone={tone}>≈ {duree(liste)} min avec parallélisation</Etiquette>
      </div>
      <p style={{ fontSize: 12.5, color: T.sub, margin: "4px 0 12px" }}>{sousTitre}</p>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 2 }}>
        {liste.map(({ r, n, min, jours }) => (
          <li key={r.id}>
            Cuisiner <strong>{fr(n)} portion{n > 1 ? "s" : ""}</strong> — <NomRecette nom={r.nom} gras={false} onClick={() => ouvrir({ r })} />{" "}
            <span style={{ color: T.sub }}>({min} min)</span> · <Etiquette tone="berry">servi {jours.join(" · ")}</Etiquette>
            {r.cong && n >= 3 && <> · <Etiquette tone="curcuma">option : 1 portion au congélateur</Etiquette></>}
          </li>
        ))}
      </ol>
    </Card>
  );
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13.5, color: T.sub, margin: 0, lineHeight: 1.6 }}>
        Le plan est dérivé du menu réel : <strong>chaque lot est cuisiné avant sa première consommation</strong>.
        Les jours de service sont indiqués sur chaque tâche — cliquez sur un nom pour ouvrir la recette.
      </p>
      <Bloc titre="Dimanche — bloc principal" sousTitre="Pour les repas du lundi au mercredi. Lancer les cuissons longues d'abord (four + cuisinière en parallèle), assembler pendant les mijotages, étiqueter contenu + date." liste={blocs.dimanche} tone="green" />
      <Bloc titre="Mercredi soir — mini-bloc" sousTitre="Pour les repas du jeudi au dimanche. Une ou deux recettes qui mijotent pendant le souper du mercredi." liste={blocs.mercredi} tone="curcuma" />
      <Bloc titre="Vendredi ou fin de semaine — cuisine fraîche" sousTitre="Volontairement frais : environ 30 min réelles, aucun réchauffé." liste={blocs.vendredi} tone="berry" />
      <Card pad={14} style={{ background: T.greenSoft, borderColor: "#BFD9C4" }}>
        <span style={{ fontSize: 13, color: T.greenDark }}>💡 Les sauces et vinaigrettes se conservent à part : les bols et salades restent croquants 4 jours.</span>
      </Card>
    </div>
  );
}

function VueEpicerie({ menu, recettes }: { menu: MenuGenere; recettes: Recette[] }) {
  const [coches, setCoches] = useState<Record<string, boolean>>({});
  const parCat = listeEpicerie(menu, recettes, COLLATIONS);
  const ordre: Cat[] = ["F", "L", "P", "G", "C", "N", "D", "V", "S", "E"];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13.5, color: T.sub, margin: 0 }}>
        Quantités consolidées pour les 7 jours{menu.portionsRepas !== 1 && <> (portions ×{fr(menu.portionsRepas)} déjà incluses)</>} —
        les ingrédients communs à plusieurs recettes sont additionnés. Les épices sont souvent déjà au garde-manger.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {ordre.filter((c) => parCat[c]).map((c) => (
          <Card key={c} pad={16}>
            <strong style={{ fontFamily: FONT_D, fontSize: 15, color: T.greenDark }}>{CAT_NOMS[c]}</strong>
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, fontSize: 13.5, lineHeight: 2.1 }}>
              {parCat[c]!.map((it) => {
                const cle = it.nom + it.u, fait = coches[cle];
                return (
                  <li key={cle}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", opacity: fait ? 0.45 : 1, textDecoration: fait ? "line-through" : "none" }}>
                      <input type="checkbox" checked={!!fait} onChange={() => setCoches({ ...coches, [cle]: !fait })} style={{ accentColor: T.green, width: 15, height: 15 }} />
                      <span><strong>{fr(it.q)} {it.u}</strong> — {it.nom}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- Application ---------- */
type Ecran = "accueil" | "quiz" | "plan";
type Onglet = "dash" | "menu" | "recettes" | "prep" | "epicerie";
const ONGLETS: [Onglet, string][] = [["dash", "Tableau de bord"], ["menu", "Menu 7 jours"], ["recettes", "Recettes"], ["prep", "Meal prep"], ["epicerie", "Épicerie"]];

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [pr, setPr] = useState<Profil>(PROFIL_VIDE);
  const [seed, setSeed] = useState(1);
  const [onglet, setOnglet] = useState<Onglet>("dash");
  const [detail, setDetail] = useState<Detail | null>(null);

  // Recettes chargées depuis Supabase au démarrage (remplace l'ancien import statique).
  const [recettes, setRecettes] = useState<Recette[] | null>(null);
  const [erreurRecettes, setErreurRecettes] = useState<string | null>(null);

  useEffect(() => {
    chargerRecettes()
      .then(setRecettes)
      .catch((e: Error) => setErreurRecettes(e.message));
  }, []);

  const cibles = useMemo(() => (pr.age && pr.lb ? calculerCibles(pr) : null), [pr]);
  const menu = useMemo(
    () => (ecran === "plan" && cibles && recettes ? genererMenu(pr, cibles, seed, recettes, COLLATIONS) : null),
    [ecran, pr, cibles, seed, recettes]
  );
  const ouvrir = (d: Detail) => setDetail(d);

  // Écran de chargement / erreur pendant la récupération des recettes Supabase.
  if (erreurRecettes) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: FONT_B, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Card style={{ maxWidth: 480, textAlign: "center" }}>
          <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>Impossible de charger les recettes : {erreurRecettes}</p>
          <p style={{ fontSize: 13, color: T.sub, margin: "8px 0 0" }}>
            Vérifie la configuration Supabase (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
          </p>
        </Card>
      </div>
    );
  }
  if (!recettes) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: FONT_B, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 15, color: T.sub }}>Chargement des recettes…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: FONT_B }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap');
        button:focus-visible, input:focus-visible { outline: 2px solid ${T.green}; outline-offset: 2px; }
      `}</style>
      <header style={{ borderBottom: `1px solid ${T.line}`, background: "#F7FAF5" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setEcran("accueil")} style={{ all: "unset", cursor: "pointer", fontFamily: FONT_D, fontSize: 21, fontWeight: 600 }}>
            Nutri<span style={{ color: T.green }}>Prep</span> <span style={{ fontSize: 12, fontWeight: 500, color: T.sub, fontFamily: FONT_B }}>IA · prototype</span>
          </button>
          {ecran === "plan" && (
            <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }} aria-label="Sections du plan">
              {ONGLETS.map(([k, lab]) => (
                <button key={k} onClick={() => setOnglet(k)} style={{
                  fontFamily: FONT_B, fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", border: "none",
                  background: onglet === k ? T.ink : "transparent", color: onglet === k ? "#fff" : T.sub,
                }}>{lab}</button>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 60px" }}>
        {ecran === "accueil" && <Accueil demarrer={() => { setPr(PROFIL_VIDE); setEcran("quiz"); }} demo={() => { setPr(PROFIL_DEMO); setEcran("plan"); setOnglet("dash"); }} />}
        {ecran === "quiz" && <Questionnaire pr={pr} setPr={setPr} valider={() => { setEcran("plan"); setOnglet("dash"); }} />}
        {ecran === "plan" && cibles && menu && (estErreur(menu)
          ? <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
              <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>{menu.erreur}</p>
              <Bouton ghost small onClick={() => setEcran("quiz")}>Modifier mon profil</Bouton>
            </Card>
          : <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                <h2 style={{ fontFamily: FONT_D, fontSize: 28, margin: 0 }}>{ONGLETS.find((o) => o[0] === onglet)![1]}</h2>
                <button onClick={() => setEcran("quiz")} style={{ all: "unset", cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.greenDark, textDecoration: "underline" }}>Modifier le profil</button>
              </div>
              {onglet === "dash" && <TableauDeBord cibles={cibles} menu={menu} pr={pr} recettes={recettes} />}
              {onglet === "menu" && <VueMenu menu={menu} cibles={cibles} regenerer={() => setSeed(seed + 1)} ouvrir={ouvrir} recettes={recettes} />}
              {onglet === "recettes" && <VueRecettes menu={menu} ouvrir={ouvrir} recettes={recettes} />}
              {onglet === "prep" && <VuePrep menu={menu} ouvrir={ouvrir} recettes={recettes} />}
              {onglet === "epicerie" && <VueEpicerie menu={menu} recettes={recettes} />}
            </>)}
      </main>
      {detail && <FicheRecette d={detail} portionsDefaut={!detail.collation && menu && !estErreur(menu) ? menu.portionsRepas : 1} onClose={() => setDetail(null)} />}
      <footer style={{ borderTop: `1px solid ${T.line}`, padding: "16px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: T.sub }}>Prototype MVP — recommandations informatives seulement ; elles ne remplacent pas l'avis d'un(e) professionnel(le) de la santé.</span>
      </footer>
    </div>
  );
}
