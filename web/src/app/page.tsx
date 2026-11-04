"use client";

import { useMemo, useState } from "react";
import regionData from "../data/regions.json";

type Test = {
  id: string; nom: string; hyp: string; se: number | null; sp: number | null;
  src: string; how?: string; pos?: string; conf: string; lrp?: number | null; lrn?: number | null; note?: string;
};
type Flag = { id: string; label: string; orient: string; niveau: string };
type Question = { id: string; texte: string; opts: [string, Record<string, number>][] };
type Hypothesis = { id: string; nom: string; prev: number; desc?: string; renvoi?: string | null };
type Cpr = { id: string; nom: string; hyp: string; items: string[]; seuils: [number, number | null, number | null][]; src: string; conf: string; note?: string };
type Region = {
  id: string; nom: string; resume: string; red_flags: Flag[]; hyps: Hypothesis[];
  questions: Question[]; tests: Test[]; cpr: Cpr[];
};
const regions = regionData as unknown as Record<string, Region>;
const regionIds = Object.keys(regions);
const navItems = ["Accueil", "Régions", "Tests & valeurs", "Sources"] as const;
type Page = (typeof navItems)[number];
const additionalQuestions: Record<string, Question> = {
  epaule: { id: "evidence_painful_arc", texte: "Le mouvement actif est-il plus limité ou douloureux que le mouvement passif ?", opts: [["Oui, surtout en actif", { coiffe: 1.5, rcrsp: 1 }], ["Non, la limitation est similaire en passif", { capsulite: 1.5 }]] },
  genou: { id: "evidence_swelling_timing", texte: "Le genou a-t-il gonflé rapidement après le traumatisme ?", opts: [["Oui, dans les premières heures", { lca: 2, fracture: 1 }], ["Non ou gonflement tardif", { menisque: 1, pfp: 0.5 }]] },
  atm: { id: "evidence_jaw_locking", texte: "Existe-t-il un blocage ou une limitation mécanique de l’ouverture ?", opts: [["Oui", { ddr_bloc: 2, ddr: 1 }], ["Non, l’ouverture est libre", { myalgie: 1, myofasciale: 1 }]] },
  lombaire: { id: "evidence_neurogenic_claudication", texte: "Les symptômes diminuent-ils en position assise ou penchée en avant ?", opts: [["Oui", { stenose: 2 }], ["Non", { mecanique: 0.5, disque: 0.5 }]] },
  cervicale: { id: "evidence_neurologic_symptoms", texte: "Une douleur ou des paresthésies descendent-elles dans le membre supérieur ?", opts: [["Oui", { radiculo: 2 }], ["Non", { mecanique: 0.5, cgh: 0.5 }]] },
  cheville: { id: "evidence_inability_walk", texte: "La marche était-elle impossible immédiatement après le traumatisme ?", opts: [["Oui", { fracture: 2, entorse: 0.5 }], ["Non", { entorse: 1 }]] },
  hanche: { id: "evidence_groin_pain", texte: "La douleur est-elle principalement inguinale et reproduite en flexion-rotation ?", opts: [["Oui", { fai: 1.5, coxarthrose: 1 }], ["Non", { gtps: 1, refere: 0.5 }]] },
  main: { id: "evidence_night_numbness", texte: "Les paresthésies sont-elles nocturnes et soulagées en secouant la main ?", opts: [["Oui", { canal: 2 }], ["Non", { cervical: 0.5, dequervain: 0.5 }]] },
};

function formatPercent(value: number) { return `${Math.round(value * 100)} %`; }
function lrs(test: Test): [number | null, number | null] {
  const lp = test.lrp ?? (test.se !== null && test.sp !== null ? test.se / (1 - test.sp) : null);
  const ln = test.lrn ?? (test.se !== null && test.sp !== null ? (1 - test.se) / test.sp : null);
  return [lp, ln];
}
function probability(pre: number, likelihoods: number[]) {
  const odds = Math.min(Math.max(pre, 0.0001), 0.9999) / (1 - Math.min(Math.max(pre, 0.0001), 0.9999));
  return (odds * likelihoods.reduce((value, likelihood) => value * Math.min(likelihood, 1000), 1)) /
    (1 + odds * likelihoods.reduce((value, likelihood) => value * Math.min(likelihood, 1000), 1));
}

function BodyChart({ onSelect }: { onSelect: (id: string) => void }) {
  const points: [string, string, number, number, number, number][] = [
    ["cervicale", "Cervicale", 48, 16, 36, 16],
    ["epaule", "Épaule", 28, 27, 38, 29],
    ["main", "Main & poignet", 12, 49, 37, 46],
    ["lombaire", "Lombaire", 72, 43, 57, 43],
    ["hanche", "Hanche", 73, 57, 57, 55],
    ["genou", "Genou", 72, 72, 57, 70],
    ["cheville", "Cheville", 70, 87, 56, 87],
    ["atm", "ATM", 82, 20, 54, 22],
  ];
  return (
    <div className="body-chart">
      <img className="body-chart-image" src="/bodychart.png" alt="Illustration d'un coureur avec les zones cliniques sélectionnables" />
      <svg className="body-lines" viewBox="0 0 100 100" aria-hidden="true">
        {points.map(([id, , x, y, tx, ty]) => <line key={id} x1={x} y1={y} x2={tx} y2={ty} />)}
      </svg>
      <div className="body-pins">
        {points.map(([id, label, x, y]) => <button key={id} className="body-pin" style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onSelect(id)} aria-label={`Ouvrir la région ${label}`}><span className="pin-dot" /><span className="pin-label">{label}</span></button>)}
      </div>
    </div>
  );
}

function Header({ page, setPage, regionName, openRegion }: { page: Page; setPage: (page: Page) => void; regionName: string; openRegion: (id: string) => void }) {
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  return <header className="topbar">
    <button className="brand" onClick={() => setPage("Accueil")}><span className="brand-mark">P</span><span>Physio<span>Test</span></span></button>
    <nav className="main-nav floating-nav" aria-label="Navigation principale">
      <button className={page === "Accueil" ? "active" : ""} onClick={() => setPage("Accueil")}>Accueil</button>
      <div className="region-menu">
        <button className={`region-menu-trigger ${page === "Régions" ? "active" : ""}`} onClick={() => setRegionMenuOpen(open => !open)} aria-expanded={regionMenuOpen}>Régions <span className="menu-chevron" /></button>
        <div className={`region-menu-list ${regionMenuOpen ? "open" : ""}`}>{regionIds.map(id => <button key={id} onClick={() => { openRegion(id); setRegionMenuOpen(false); }}>{regions[id].nom}</button>)}</div>
      </div>
      {navItems.filter(item => item !== "Régions" && item !== "Accueil").map(item => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}
    </nav>
    <div className="header-context">{regionName || "Votre guide de parcours clinique"}</div>
  </header>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("Accueil");
  const [regionId, setRegionId] = useState("epaule");
  const [activeTab, setActiveTab] = useState("Red Flags");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const region = regions[regionId];
  const tabs = ["Red Flags", "Anamnèse", "Examen", "Synthèse"];
  const openRegion = (id: string) => { setRegionId(id); setPage("Régions"); setActiveTab("Red Flags"); };
  const selectedFlags = region.red_flags.filter(flag => flags[`${regionId}-${flag.id}`]);
  const questions = useMemo(() => additionalQuestions[regionId] ? [...region.questions, additionalQuestions[regionId]] : region.questions, [region, regionId]);
  const probabilities = useMemo(() => region.hyps.map(hypothesis => {
    let score = 0;
    questions.forEach(question => {
      const answerIndex = answers[question.id];
      if (answerIndex !== undefined) score += question.opts[answerIndex][1][hypothesis.id] ?? 0;
    });
    const pre = Math.min(Math.max(probability(hypothesis.prev, [1.5 ** score]), .01), .95);
    const likelihoods = region.tests.filter(test => test.hyp === hypothesis.id && results[test.id] && results[test.id] !== "—").map(test => {
      const [positive, negative] = lrs(test);
      return results[test.id] === "Positif" ? positive ?? 1 : negative ?? 1;
    });
    return { ...hypothesis, pre, post: probability(pre, likelihoods) };
  }), [answers, questions, region, results]);
  const visibleTests = useMemo(() => regionIds.flatMap(id => regions[id].tests.map(test => ({ ...test, region: regions[id].nom }))).filter(test =>
    `${test.nom} ${test.src} ${test.region}`.toLowerCase().includes(search.toLowerCase())), [search, regionId]); // regionId keeps the view fresh after navigation.

  const resetRegion = () => {
    setFlags(current => Object.fromEntries(Object.keys(current).filter(key => !key.startsWith(`${regionId}-`)).map(key => [key, current[key]])));
    setAnswers({});
    setResults({});
  };

  return <div className="site-shell">
    <Header page={page} setPage={setPage} regionName={page === "Régions" ? region.nom : ""} openRegion={openRegion} />
    <main>
      {page === "Accueil" && <section className="home-page fade-in">
        <div className="hero">
          <div className="eyebrow">RAISONNEMENT CLINIQUE · ÉDITION 2026</div>
          <h1>Voir plus clair.<br /><em>Décider avec justesse.</em></h1>
          <p>PhysioTest structure votre examen clinique, de l&apos;interrogatoire à l&apos;interprétation des tests, sans remplacer votre expertise.</p>
          <button className="primary-button" onClick={() => document.getElementById("body-map")?.scrollIntoView({ behavior: "smooth" })}>Choisir une région <span>↓</span></button>
        </div>
        <section id="body-map" className="map-section"><div className="section-heading"><div><span className="eyebrow">COMMENCER ICI</span><h2>Sélectionnez une zone</h2></div><p>Sélectionnez une zone sur la body chart pour ouvrir son parcours clinique. Repérez les Red Flags, précisez votre hypothèse, sélectionnez vos tests et observez l&apos;évolution des probabilités.</p></div><BodyChart onSelect={openRegion} /></section>
        <div className="trust-row"><div><strong>8</strong><span>régions cliniques</span></div><div><strong>80+</strong><span>tests documentés</span></div><div><strong>100%</strong><span>pédagogique</span></div></div>
      </section>}

      {page === "Régions" && <section className="region-page fade-in">
        <div className="region-hero"><div><div className="eyebrow">PARCOURS CLINIQUE</div><h1>{region.nom}</h1><p>{region.resume}</p></div><div className="region-stat"><strong>{region.tests.length}</strong><span>tests & règles<br />diagnostiques</span></div></div>
        <div className="region-toolbar"><div className="tabs">{tabs.map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}{tab === "Red Flags" && selectedFlags.length > 0 && <b>{selectedFlags.length}</b>}</button>)}</div><button className="reset-button" onClick={resetRegion}>Réinitialiser</button></div>
        {activeTab === "Red Flags" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">SÉCURITÉ D&apos;ABORD</span><h2>Red Flags</h2></div><p>Cliquez sur un signe présent pour afficher la conduite à tenir.</p></div><div className="flag-grid">{region.red_flags.map(flag => { const key = `${regionId}-${flag.id}`; return <article key={flag.id} role="button" tabIndex={0} className={`flag-card ${flag.niveau} ${flags[key] ? "selected" : ""}`} onClick={() => setFlags({ ...flags, [key]: !flags[key] })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setFlags({ ...flags, [key]: !flags[key] }); }}><strong>{flag.label}</strong><div className="flag-action"><span>{flags[key] ? "CONDUITE À TENIR" : "SÉLECTIONNER POUR VOIR LA CONDUITE"}</span><p>{flag.orient}</p></div></article>; })}</div></section>}
        {activeTab === "Anamnèse" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 02</span><h2>Anamnèse</h2></div><p>Chaque réponse déplace les probabilités de départ. Cette heuristique oriente l&apos;examen, elle ne diagnostique pas.</p></div><div className="anam-layout"><div className="question-list">{questions.map((question, index) => <article className="question-card" key={question.id}><span className="question-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{question.texte}</h3>{question.opts.map((option, optionIndex) => <label className={`option ${answers[question.id] === optionIndex ? "chosen" : ""}`} key={option[0]}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} />{option[0]}</label>)}</div></article>)}</div><aside className="probability-panel"><div className="eyebrow">PROBABILITÉS ACTUELLES</div><h3>Vos hypothèses évoluent</h3>{[...probabilities].sort((a, b) => b.pre - a.pre).map(item => <div className="probability-row" key={item.id}><div><span>{item.nom}</span><b>{formatPercent(item.pre)}</b></div><div className="probability-track"><i style={{ width: `${item.pre * 100}%` }} /></div></div>)}</aside></div></section>}
        {activeTab === "Examen" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 03</span><h2>Examen</h2></div><p>Renseignez les tests réalisés pour mettre à jour votre raisonnement.</p></div>{region.hyps.map(hypothesis => { const hypothesisTests = region.tests.filter(test => test.hyp === hypothesis.id); if (!hypothesisTests.length) return null; const probabilityItem = probabilities.find(item => item.id === hypothesis.id); return <section className="hypothesis-group" key={hypothesis.id}><div className="hypothesis-heading"><div><span className="eyebrow">HYPOTHÈSE</span><h3>{hypothesis.nom}</h3></div><div className="hypothesis-probabilities"><span>Pré-test <b>{formatPercent(probabilityItem?.pre ?? hypothesis.prev)}</b></span><span>Post-test <b>{formatPercent(probabilityItem?.post ?? hypothesis.prev)}</b></span></div></div><div className="test-list">{hypothesisTests.map(test => { const [lp, ln] = lrs(test); return <article className="test-card" key={test.id}><div className="test-main"><div className="test-title"><h3>{test.nom}</h3><span className={test.conf === "V" ? "verified" : "review"}>{test.conf === "V" ? "Valeur vérifiée" : "À vérifier"}</span></div><p>{[test.how, test.pos && `Positif si : ${test.pos}`].filter(Boolean).join(". ")}</p>{test.note && <small>{test.note}</small>}</div><div className="test-stats"><span>Se <b>{test.se === null ? "—" : test.se.toFixed(2)}</b></span><span>Sp <b>{test.sp === null ? "—" : test.sp.toFixed(2)}</b></span><span>LR+ <b>{lp === null ? "—" : lp.toFixed(1)}</b></span><span>LR− <b>{ln === null ? "—" : ln.toFixed(2)}</b></span><small>{test.src}</small></div><select value={results[test.id] || "—"} onChange={event => setResults({ ...results, [test.id]: event.target.value })}><option>—</option><option>Positif</option><option>Négatif</option></select></article>; })}</div></section> })}{region.cpr.length > 0 && <div className="cpr-list"><div className="section-heading"><div><span className="eyebrow">RÈGLES DE PRÉDICTION</span><h2>Clusters cliniques</h2></div></div>{region.cpr.map(rule => <article className="summary-card" key={rule.id}><h3>{rule.nom}</h3><p>{rule.items.join(" · ")}</p><small>{rule.src} · {rule.note}</small></article>)}</div>}</section>}
        {activeTab === "Synthèse" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 04</span><h2>Synthèse</h2></div><p>Votre raisonnement clinique, regroupé au même endroit.</p></div><div className="summary-layout"><div className="summary-card summary-hypotheses"><span className="eyebrow">HYPOTHÈSES</span>{[...probabilities].sort((a, b) => b.post - a.post).slice(0, 6).map(item => <div className="summary-test" key={item.id}><strong>{item.nom}</strong><span>{formatPercent(item.pre)} → {formatPercent(item.post)}</span></div>)}</div></div></section>}
      </section>}

      {page === "Tests & valeurs" && <section className="library-page fade-in"><div className="page-heading"><span className="eyebrow">BIBLIOTHÈQUE CLINIQUE</span><h1>Tests & valeurs</h1><p>Explorez les performances diagnostiques documentées de toutes les régions.</p></div><input className="search-input" placeholder="Rechercher un test, une région ou une source…" value={search} onChange={event => setSearch(event.target.value)} /><div className="library-grid">{visibleTests.map(test => { const [lp, ln] = lrs(test); return <article className="library-card" key={`${test.region}-${test.id}`}><div><span className="eyebrow">{test.region}</span><h3>{test.nom}</h3><p>{test.src}</p></div><div className="library-metrics"><span>Se <b>{test.se?.toFixed(2) ?? "—"}</b></span><span>Sp <b>{test.sp?.toFixed(2) ?? "—"}</b></span><span>LR+ <b>{lp?.toFixed(1) ?? "—"}</b></span><span>LR− <b>{ln?.toFixed(2) ?? "—"}</b></span></div></article>; })}</div></section>}
      {page === "Sources" && <section className="sources-page fade-in"><div className="page-heading"><span className="eyebrow">TRANSPARENCE</span><h1>Sources</h1><p>Chaque test est relié à une recherche PubMed ciblée sur son nom et sa référence, pour retrouver l&apos;article original indexé.</p></div><div className="source-list">{Object.values(regions).flatMap(item => item.tests.map(test => ({ ...test, region: item.nom }))).map((source, index) => <article className="source-row" key={`${source.region}-${source.id}-${index}`}><span className="source-dot" /><strong>{source.nom}</strong><span>{source.src} · {source.region}</span><a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${source.nom} ${source.src}`)}`} target="_blank" rel="noreferrer">Rechercher l&apos;article original ↗</a></article>)}</div></section>}
    </main>
    <footer><div><strong>Un parcours pensé pour la pratique</strong><p>Repérez les Red Flags, précisez votre hypothèse, sélectionnez vos tests et observez l&apos;évolution des probabilités.</p></div><span>PhysioTest · conçu par Antonin-m84</span></footer>
  </div>;
}
