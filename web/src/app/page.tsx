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
  const points = [
    ["cervicale", "Cervicale", "neck"], ["epaule", "Épaule", "shoulder"],
    ["main", "Main & poignet", "hand"], ["lombaire", "Lombaire", "back"],
    ["hanche", "Hanche", "hip"], ["genou", "Genou", "knee"],
    ["cheville", "Cheville", "ankle"], ["atm", "ATM", "jaw"],
  ];
  return (
    <div className="body-chart">
      <div className="silhouette" aria-hidden="true"><span className="head" /><span className="torso" /><span className="arm left" /><span className="arm right" /><span className="leg left" /><span className="leg right" /></div>
      <div className="body-points">
        {points.map(([id, label, cls]) => <button key={id} className={`body-point ${cls}`} onClick={() => onSelect(id)}>{label}<span>→</span></button>)}
      </div>
    </div>
  );
}

function Header({ page, setPage, regionName }: { page: Page; setPage: (page: Page) => void; regionName: string }) {
  return <header className="topbar">
    <button className="brand" onClick={() => setPage("Accueil")}><span className="brand-mark">P</span><span>Physio<span>Test</span></span></button>
    <nav className="main-nav" aria-label="Navigation principale">
      {navItems.map(item => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}
    </nav>
    <div className="header-context">{regionName || "Votre parcours clinique"} <i>⌄</i></div>
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
  const probabilities = useMemo(() => region.hyps.map(hypothesis => {
    let score = 0;
    region.questions.forEach(question => {
      const answerIndex = answers[question.id];
      if (answerIndex !== undefined) score += question.opts[answerIndex][1][hypothesis.id] ?? 0;
    });
    const pre = Math.min(Math.max(probability(hypothesis.prev, [1.5 ** score]), .01), .95);
    const likelihoods = region.tests.filter(test => test.hyp === hypothesis.id && results[test.id] && results[test.id] !== "—").map(test => {
      const [positive, negative] = lrs(test);
      return results[test.id] === "Positif" ? positive ?? 1 : negative ?? 1;
    });
    return { ...hypothesis, pre, post: probability(pre, likelihoods) };
  }), [answers, region, results]);
  const visibleTests = useMemo(() => regionIds.flatMap(id => regions[id].tests.map(test => ({ ...test, region: regions[id].nom }))).filter(test =>
    `${test.nom} ${test.src} ${test.region}`.toLowerCase().includes(search.toLowerCase())), [search, regionId]); // regionId keeps the view fresh after navigation.

  const resetRegion = () => {
    setFlags(current => Object.fromEntries(Object.keys(current).filter(key => !key.startsWith(`${regionId}-`)).map(key => [key, current[key]])));
    setAnswers({});
    setResults({});
  };

  return <div className="site-shell">
    <Header page={page} setPage={setPage} regionName={page === "Régions" ? region.nom : ""} />
    <main>
      {page === "Accueil" && <section className="home-page fade-in">
        <div className="hero">
          <div className="eyebrow">RAISONNEMENT CLINIQUE · ÉDITION 2026</div>
          <h1>Voir plus clair.<br /><em>Décider avec justesse.</em></h1>
          <p>PhysioTest structure votre examen clinique, de l&apos;interrogatoire à l&apos;interprétation des tests, sans remplacer votre expertise.</p>
          <button className="primary-button" onClick={() => document.getElementById("body-map")?.scrollIntoView({ behavior: "smooth" })}>Choisir une région <span>↓</span></button>
        </div>
        <div className="home-intro"><div><span className="number">01</span><h2>Un parcours pensé pour la pratique</h2></div><p>Repérez les Red Flags, précisez votre hypothèse, sélectionnez vos tests et observez l&apos;évolution des probabilités. Les données sont présentées avec leur niveau de fiabilité et leur source.</p></div>
        <section id="body-map" className="map-section"><div className="section-heading"><div><span className="eyebrow">COMMENCER ICI</span><h2>Sélectionnez une zone</h2></div><p>Choisissez une partie du corps pour ouvrir son parcours clinique.</p></div><BodyChart onSelect={openRegion} /></section>
        <div className="trust-row"><div><strong>8</strong><span>régions cliniques</span></div><div><strong>80+</strong><span>tests documentés</span></div><div><strong>100%</strong><span>pédagogique</span></div></div>
      </section>}

      {page === "Régions" && <section className="region-page fade-in">
        <div className="region-hero"><div><button className="back-link" onClick={() => setPage("Accueil")}>← Accueil</button><div className="eyebrow">PARCOURS CLINIQUE</div><h1>{region.nom}</h1><p>{region.resume}</p></div><div className="region-stat"><strong>{region.tests.length}</strong><span>tests & règles<br />diagnostiques</span></div></div>
        <div className="region-toolbar"><div className="tabs">{tabs.map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}{tab === "Red Flags" && selectedFlags.length > 0 && <b>{selectedFlags.length}</b>}</button>)}</div><button className="reset-button" onClick={resetRegion}>Réinitialiser</button></div>
        {activeTab === "Red Flags" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">SÉCURITÉ D&apos;ABORD</span><h2>Red Flags</h2></div><p>Sélectionnez les signes présents. La conduite à tenir est affichée dans chaque carte.</p></div><div className="flag-grid">{region.red_flags.map(flag => <article key={flag.id} className={`flag-card ${flag.niveau} ${flags[`${regionId}-${flag.id}`] ? "selected" : ""}`}><label><input type="checkbox" checked={Boolean(flags[`${regionId}-${flag.id}`])} onChange={event => setFlags({ ...flags, [`${regionId}-${flag.id}`]: event.target.checked })} /><span className="custom-check">✓</span><strong>{flag.label}</strong></label><div className="flag-action"><span>CONDUITE À TENIR</span><p>{flag.orient}</p></div></article>)}</div></section>}
        {activeTab === "Anamnèse" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 02</span><h2>Anamnèse</h2></div><p>Chaque réponse déplace les probabilités de départ. Cette heuristique oriente l&apos;examen, elle ne diagnostique pas.</p></div><div className="question-list">{region.questions.map(question => <article className="question-card" key={question.id}><span className="question-index">{String(region.questions.indexOf(question) + 1).padStart(2, "0")}</span><div><h3>{question.texte}</h3>{question.opts.map((option, index) => <label className={`option ${answers[question.id] === index ? "chosen" : ""}`} key={option[0]}><input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers({ ...answers, [question.id]: index })} />{option[0]}</label>)}</div></article>)}</div></section>}
        {activeTab === "Examen" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 03</span><h2>Examen</h2></div><p>Renseignez les tests réalisés pour mettre à jour votre raisonnement.</p></div><div className="test-list">{region.tests.map(test => { const [lp, ln] = lrs(test); return <article className="test-card" key={test.id}><div className="test-main"><div className="test-title"><h3>{test.nom}</h3><span className={test.conf === "V" ? "verified" : "review"}>{test.conf === "V" ? "Valeur vérifiée" : "À vérifier"}</span></div><p>{[test.how, test.pos && `Positif si : ${test.pos}`].filter(Boolean).join(". ")}</p>{test.note && <small>{test.note}</small>}</div><div className="test-stats"><span>Se <b>{test.se === null ? "—" : test.se.toFixed(2)}</b></span><span>Sp <b>{test.sp === null ? "—" : test.sp.toFixed(2)}</b></span><span>LR+ <b>{lp === null ? "—" : lp.toFixed(1)}</b></span><span>LR− <b>{ln === null ? "—" : ln.toFixed(2)}</b></span><small>{test.src}</small></div><select value={results[test.id] || "—"} onChange={event => setResults({ ...results, [test.id]: event.target.value })}><option>—</option><option>Positif</option><option>Négatif</option></select></article>; })}</div>{region.cpr.length > 0 && <div className="cpr-list"><div className="section-heading"><div><span className="eyebrow">RÈGLES DE PRÉDICTION</span><h2>Clusters cliniques</h2></div></div>{region.cpr.map(rule => <article className="summary-card" key={rule.id}><h3>{rule.nom}</h3><p>{rule.items.join(" · ")}</p><small>{rule.src} · {rule.note}</small></article>)}</div>}</section>}
        {activeTab === "Synthèse" && <section className="clinical-grid slide-up"><div className="section-heading"><div><span className="eyebrow">ÉTAPE 04</span><h2>Synthèse</h2></div><p>Votre raisonnement clinique, regroupé au même endroit.</p></div><div className="summary-layout"><div className="summary-card"><span className="eyebrow">RED FLAGS SÉLECTIONNÉS</span>{selectedFlags.length ? selectedFlags.map(flag => <div className="summary-flag" key={flag.id}><strong>{flag.label}</strong><span>{flag.orient}</span></div>) : <p className="muted">Aucun Red Flag sélectionné.</p>}</div><div className="summary-card"><span className="eyebrow">HYPOTHÈSES</span>{probabilities.sort((a, b) => b.post - a.post).slice(0, 6).map(item => <div className="summary-test" key={item.id}><strong>{item.nom}</strong><span>{formatPercent(item.pre)} → {formatPercent(item.post)}</span></div>)}</div></div></section>}
      </section>}

      {page === "Tests & valeurs" && <section className="library-page fade-in"><div className="page-heading"><span className="eyebrow">BIBLIOTHÈQUE CLINIQUE</span><h1>Tests & valeurs</h1><p>Explorez les performances diagnostiques documentées de toutes les régions.</p></div><input className="search-input" placeholder="Rechercher un test, une région ou une source…" value={search} onChange={event => setSearch(event.target.value)} /><div className="library-grid">{visibleTests.map(test => { const [lp, ln] = lrs(test); return <article className="library-card" key={`${test.region}-${test.id}`}><div><span className="eyebrow">{test.region}</span><h3>{test.nom}</h3><p>{test.src}</p></div><div className="library-metrics"><span>Se <b>{test.se?.toFixed(2) ?? "—"}</b></span><span>Sp <b>{test.sp?.toFixed(2) ?? "—"}</b></span><span>LR+ <b>{lp?.toFixed(1) ?? "—"}</b></span><span>LR− <b>{ln?.toFixed(2) ?? "—"}</b></span></div></article>; })}</div></section>}
      {page === "Sources" && <section className="sources-page fade-in"><div className="page-heading"><span className="eyebrow">TRANSPARENCE</span><h1>Sources</h1><p>Chaque valeur est accompagnée de sa source et de son niveau de fiabilité.</p></div><div className="source-list">{Object.values(regions).flatMap(item => item.tests.map(test => ({ ...test, region: item.nom }))).reduce((acc, test) => { const key = `${test.src}`; if (!acc.some(item => item.src === key)) acc.push({ src: key, region: test.region }); return acc; }, [] as {src: string; region: string}[]).map(source => <article className="source-row" key={source.src}><span className="source-dot" /><strong>{source.src}</strong><span>{source.region}</span></article>)}</div></section>}
    </main>
    <footer><span>PhysioTest</span><span>Outil pédagogique d&apos;aide au raisonnement clinique.</span></footer>
  </div>;
}
