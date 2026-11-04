"""Rehab · raisonnement clinique pour kinés.

Parcours guidé : Red Flags, anamnèse, examen, synthèse. Les tests et règles de prédiction
sont décrits par leurs valeurs diagnostiques ; les probabilités sont mises à jour par
rapports de vraisemblance. Outil pédagogique.
"""
import altair as alt
import pandas as pd
import streamlit as st

from core import (apply_lr, cpr_lr, fr, lrs, pct, piege, posterior, pouvoir,
                  pretest, rapport, sources_of)
from regions import REGIONS

st.set_page_config(page_title="PhysioTest", page_icon="🩺", layout="wide")

ENCRE, ACCENT, PALE = "#14262D", "#0B5563", "#9DB4BA"
NIVEAUX = {
    "urgent": ("Urgent", "Orienter sans délai"),
    "rapide": ("Rapide", "Avis médical rapide"),
    "avis": ("À surveiller", "Avis médical à envisager"),
}
NP = "Non précisé"
RESULTATS = ["—", "Positif", "Négatif"]

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Public+Sans:wght@400;500;600&display=swap');
.stApp, .stMarkdown, label, button, input, textarea, [data-baseweb="tab"] { font-family: 'Public Sans', system-ui, sans-serif; }
h1, h2, h3 { font-family: 'Newsreader', Georgia, serif !important; font-weight: 600 !important; letter-spacing: -0.01em; }
h1 { font-size: 2.3rem !important; margin-bottom: .1rem; }
.resume { color: #4A5E65; font-size: 1.02rem; margin: 0 0 1.1rem 0; max-width: 60ch; }
.red-flag { border-left: 4px solid var(--c); padding: .5rem .85rem; margin: .3rem 0; background: rgba(20,38,45,.035); }
.red-flag .orient { color: var(--c); font-weight: 600; font-size: .9rem; }
.red-flag.urgent { --c: #A62B1F; } .red-flag.rapide { --c: #8A5A00; } .red-flag.avis { --c: #3F6470; }
.badge { font-size: .74rem; font-weight: 600; padding: 1px 7px; border-radius: 3px; margin-left: .4rem; }
.badge.v { background: #DCEBE3; color: #1F5A3E; } .badge.m { background: #F4E6C8; color: #7A4F00; }
.chiffres { font-size: .76rem; font-variant-numeric: tabular-nums; line-height: 1.3; color: #62757B; }
.chiffres .pouvoir { color: #4A5E65; font-size: .74rem; font-style: italic; }
.test-detail { min-width: 0; }
.test-detail strong { font-size: 1rem; }
.test-detail .stCaption { line-height: 1.35; }
.red-flag-label { overflow-wrap: anywhere; }
.sep { border-top: 1px solid #C9D6D8; margin: .7rem 0; }
[data-testid="stSidebar"] h3 { font-size: 1.35rem !important; }
.stTabs [data-baseweb="tab"] { font-weight: 500; }
.brand-bar { display: flex; align-items: center; gap: .8rem; padding: .55rem 0 1rem; border-bottom: 1px solid #D7E1E2; margin-bottom: 1.4rem; }
.brand-name { color: #0B5563; font-family: 'Newsreader', Georgia, serif; font-size: 1.8rem; font-weight: 600; }
.home-card { background: linear-gradient(135deg, #EEF5F4, #F8FBFA); border: 1px solid #D7E5E3; border-radius: 16px; padding: 1.5rem; }
.body-chart { background: #F7FAF9; border: 1px solid #D7E5E3; border-radius: 20px; padding: 1.2rem; text-align: center; }
.body-figure { font-size: 7rem; line-height: 1; color: #0B5563; padding: 1.2rem 0; }
.interest-card { min-height: 5.2rem; }
[data-testid="stVerticalBlockBorderWrapper"] { border-color: #D7E5E3; border-radius: 12px; }
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)


# ---------- état ----------
def key(rid, *parts):
    return "_".join([rid, *parts])


def reset(rid):
    for s in [s for s in st.session_state if s.startswith(rid + "_")]:
        del st.session_state[s]


def goto(rid):
    st.session_state["region"] = rid


def flagged(R):
    return [f for f in R["red_flags"] if st.session_state.get(key(R["id"], "rf", f["id"]))]


def answers(R):
    out = {}
    for q in R["questions"]:
        v = st.session_state.get(key(R["id"], "q", q["id"]), NP)
        labels = [o[0] for o in q["opts"]]
        out[q["id"]] = labels.index(v) if v in labels else None
    return out


def pre_values(R):
    base = pretest(R, answers(R))
    if st.session_state.get(key(R["id"], "adjust")):
        pre = {h: st.session_state.get(key(R["id"], "pre", h), round(base[h] * 100)) / 100 for h in base}
        return pre, base
    return base, base


def compute(R):
    rid = R["id"]
    pre, _ = pre_values(R)
    rows, tests_done, cpr_done = [], [], []
    for h in R["hyps"]:
        lrl = []
        for t in R["tests"]:
            if t["hyp"] != h["id"]:
                continue
            res = st.session_state.get(key(rid, "t", t["id"]), "—")
            if res == "—":
                continue
            lp, ln = lrs(t)
            lr = (lp if lp is not None else 1.0) if res == "Positif" else (ln if ln is not None else 1.0)
            lrl.append(lr)
            tests_done.append(dict(nom=t["nom"], res=res, lr=lr, src=t["src"]))
        for c in R["cpr"]:
            if c["hyp"] != h["id"] or not st.session_state.get(key(rid, "c", c["id"], "on")):
                continue
            n = sum(bool(st.session_state.get(key(rid, "c", c["id"], str(i)))) for i in range(len(c["items"])))
            lr, txt = cpr_lr(c, n)
            lrl.append(lr)
            cpr_done.append(dict(nom=c["nom"], n=n, txt=txt, src=c["src"]))
        rows.append(dict(hid=h["id"], nom=h["nom"], pre=pre[h["id"]],
                         post=posterior(pre[h["id"]], lrl), k=len(lrl), renvoi=h["renvoi"]))
    return rows, tests_done, cpr_done


def badge(conf):
    return ('<span class="badge v">valeur vérifiée</span>' if conf == "V"
            else '<span class="badge m">à vérifier</span>')


def chart_probas(rows, avec_post=True):
    order = [r["nom"] for r in sorted(rows, key=lambda r: -r["post" if avec_post else "pre"])]
    data = []
    for r in rows:
        data.append(dict(Hypothèse=r["nom"], Moment="Pré-test", Probabilité=r["pre"]))
        if avec_post:
            data.append(dict(Hypothèse=r["nom"], Moment="Post-test", Probabilité=r["post"]))
    df = pd.DataFrame(data)
    enc = dict(
        y=alt.Y("Hypothèse:N", sort=order, title=None, axis=alt.Axis(labelLimit=320)),
        x=alt.X("Probabilité:Q", scale=alt.Scale(domain=[0, 1]), axis=alt.Axis(format="%", title=None)),
        color=alt.Color("Moment:N", scale=alt.Scale(domain=["Pré-test", "Post-test"], range=[PALE, ACCENT]),
                        legend=alt.Legend(orient="bottom", title=None) if avec_post else None),
        tooltip=["Hypothèse", "Moment", alt.Tooltip("Probabilité:Q", format=".0%")],
    )
    if avec_post:
        enc["yOffset"] = "Moment:N"
    h = max(160, 34 * len(rows) * (2 if avec_post else 1))
    return alt.Chart(df).mark_bar().encode(**enc).properties(height=h)


ids = list(REGIONS)
def select_region(rid):
    st.session_state["region"] = rid
    st.session_state["page"] = "Régions"


def render_library(R):
    st.markdown("## Tests et valeurs diagnostiques")
    st.caption("Compare les performances diagnostiques disponibles pour la région sélectionnée ou pour toutes les régions.")
    toutes = st.toggle("Toutes les régions", value=False, key="library_all")
    pool = []
    for reg in (REGIONS.values() if toutes else [R]):
        names = {h["id"]: h["nom"] for h in reg["hyps"]}
        for t in reg["tests"]:
            lp, ln = lrs(t)
            pool.append(dict(Région=reg["nom"], Test=t["nom"], Cible=names[t["hyp"]], Se=t["se"], Sp=t["sp"],
                             **{"LR+": lp, "LR−": ln}, Pouvoir=pouvoir(t), Source=t["src"],
                             Valeur="vérifiée" if t["conf"] == "V" else "à vérifier"))
    df = pd.DataFrame(pool)
    f1, f2, f3 = st.columns([2, 2, 1.4])
    pick = f1.multiselect("Cible", sorted(df["Cible"].unique()))
    txt = f2.text_input("Recherche")
    seul_v = f3.checkbox("Valeurs vérifiées seulement")
    if pick:
        df = df[df["Cible"].isin(pick)]
    if txt:
        df = df[df.apply(lambda r: txt.lower() in " ".join(map(str, r.values)).lower(), axis=1)]
    if seul_v:
        df = df[df["Valeur"] == "vérifiée"]
    st.dataframe(df, hide_index=True, width="stretch", column_config={
        "Se": st.column_config.NumberColumn(format="%.2f"), "Sp": st.column_config.NumberColumn(format="%.2f"),
        "LR+": st.column_config.NumberColumn(format="%.1f"), "LR−": st.column_config.NumberColumn(format="%.2f")})


def render_sources(R):
    st.markdown("## Sources")
    st.caption("Niveau de fiabilité des valeurs utilisées dans l'application.")
    for src, noms in sorted(sources_of(R).items()):
        st.markdown(f"**{src}**  \n{'; '.join(noms)}")
    st.markdown("**Red Flags** : Finucane 2020, règles d'Ottawa, règle canadienne du rachis cervical, "
                "règles NEXUS, cadre IFOMPT et critères DC/TMD.")


if "region" not in st.session_state:
    st.session_state["region"] = ids[0]
if "page" not in st.session_state:
    st.session_state["page"] = "Accueil"

rid = st.session_state["region"]
R = REGIONS[rid]
st.markdown(
    '<div class="brand-bar"><img src="https://github.com/Antonin-m84.png" width="42" height="42" '
    'style="border-radius:50%;object-fit:cover"><span class="brand-name">PhysioTest</span></div>',
    unsafe_allow_html=True,
)
nav, region_select = st.columns([1.2, 1])
page = nav.radio("Navigation", ["Accueil", "Régions", "Tests et valeurs", "Sources"],
                 key="page", horizontal=True, label_visibility="collapsed")
if page == "Régions":
    selected = region_select.selectbox("Région", ids, index=ids.index(rid),
                                       format_func=lambda i: REGIONS[i]["nom"])
    if selected != rid:
        st.session_state["region"] = selected
        st.rerun()

if page == "Accueil":
    st.markdown("# Le raisonnement clinique, plus clair.")
    st.markdown(
        '<div class="home-card"><h3>À quoi sert PhysioTest ?</h3>'
        "<p>PhysioTest aide les kinés à structurer l'interrogatoire, repérer les Red Flags, "
        "choisir les tests pertinents et interpréter leurs valeurs diagnostiques.</p>"
        "<p>C'est un outil pédagogique : il ne remplace ni l'examen clinique, ni le jugement du praticien.</p>"
        "<strong>Commence par sélectionner une partie du corps sur la carte ci-dessous.</strong></div>",
        unsafe_allow_html=True,
    )
    st.markdown("## Choisir une région")
    left, right = st.columns([1, 1.5])
    with left:
        st.markdown('<div class="body-chart"><div class="body-figure">🧍</div>'
                    "<strong>Carte corporelle</strong><br><span>Sélectionne une zone pour ouvrir son parcours.</span></div>",
                    unsafe_allow_html=True)
    with right:
        for row in (ids[:4], ids[4:]):
            cols = st.columns(4)
            for col, region_id in zip(cols, row):
                with col:
                    with st.container(border=True):
                        st.button(REGIONS[region_id]["nom"], key=f"home_{region_id}",
                                  on_click=select_region, args=(region_id,), width="stretch")
    st.stop()

if page == "Tests et valeurs":
    render_library(R)
    st.stop()

if page == "Sources":
    render_sources(R)
    st.stop()

n_t = len(R["tests"]) + len(R["cpr"])
n_v = sum(t["conf"] == "V" for t in R["tests"] + R["cpr"])
st.caption(f"{len(R['red_flags'])} Red Flags · {len(R['hyps'])} hypothèses · {n_t} tests et règles · "
           f"{n_v} valeurs vérifiées")
st.button("Réinitialiser cette région", on_click=reset, args=(rid,), width="content")

# ---------- en-tête ----------
st.markdown(f"# {R['nom']}")
st.markdown(f"<p class='resume'>{R['resume']}</p>", unsafe_allow_html=True)

flags = flagged(R)
for niv, fn in (("urgent", st.error), ("rapide", st.warning), ("avis", st.info)):
    sel = [f for f in flags if f["niveau"] == niv]
    if sel:
        fn(f"{len(sel)} Red Flag(s) {NIVEAUX[niv][0].lower()} cochée(s) : {sel[0]['orient']}"
           + (" (et d'autres)" if len(sel) > 1 else ""))

tab_alert, tab_anam, tab_exam, tab_syn = st.tabs(
    ["Red Flags", "Anamnèse", "Examen", "Synthèse"])

rows, tests_done, cpr_done = compute(R)

# ---------- Red Flags ----------
with tab_alert:
    st.markdown("### Red Flags")
    st.caption("Sélectionne les signes présents. Chaque sélection apparaît dans la synthèse et déclenche une orientation explicite.")
    if flags:
        st.warning(f"{len(flags)} Red Flag(s) sélectionné(s) : la conduite à tenir est visible dans chaque carte et dans la synthèse.")
    for niv in ("urgent", "rapide", "avis"):
        group = [f for f in R["red_flags"] if f["niveau"] == niv]
        if not group:
            continue
        st.markdown(f"**{NIVEAUX[niv][0]}**")
        cols = st.columns(2)
        for i, f in enumerate(group):
            with cols[i % 2]:
                with st.container(border=True):
                    st.checkbox(f["label"], key=key(rid, "rf", f["id"]))
                    st.markdown(f"<div class='red-flag {niv}'><strong>Conduite à tenir</strong><br>"
                                f"<span class='orient'>{f['orient']}</span></div>",
                                unsafe_allow_html=True)
    if not flags:
        st.success("Aucun Red Flag coché : poursuivre avec l'anamnèse.")

# ---------- anamnèse ----------
with tab_anam:
    st.markdown("### Anamnèse")
    st.caption("Chaque réponse déplace les probabilités de départ. Le calcul est une heuristique pédagogique "
               "(prévalence de départ × 1,5 par point de score) : il oriente l'examen, il ne diagnostique pas.")
    left, right = st.columns([1.1, 1])
    with left:
        for q in R["questions"]:
            st.radio(q["texte"], [NP] + [o[0] for o in q["opts"]], key=key(rid, "q", q["id"]))
    with right:
        st.markdown("**Orientation initiale**")
        st.altair_chart(chart_probas(rows, avec_post=False), width="stretch")

# ---------- examen ----------
with tab_exam:
    st.markdown("### Examen")
    st.caption("Les hypothèses sont classées selon l'anamnèse. Renseigne les tests réalisés : "
               "chaque résultat met à jour la probabilité par son rapport de vraisemblance.")
    _, base = pre_values(R)
    if st.checkbox("Ajuster manuellement les probabilités pré-test", key=key(rid, "adjust")):
        cols = st.columns(3)
        for i, h in enumerate(R["hyps"]):
            cols[i % 3].slider(h["nom"], 1, 95, round(base[h["id"]] * 100), format="%d %%",
                               key=key(rid, "pre", h["id"]))
        rows, tests_done, cpr_done = compute(R)

    by_id = {h["id"]: h for h in R["hyps"]}
    ordered = sorted(rows, key=lambda r: -r["pre"])
    for i, r in enumerate(ordered):
        h = by_id[r["hid"]]
        tests = [t for t in R["tests"] if t["hyp"] == h["id"]]
        cprs = [c for c in R["cpr"] if c["hyp"] == h["id"]]
        if not tests and not cprs:
            with st.container():
                st.markdown(f"**{h['nom']}** : {pct(r['pre'])}")
                if h["desc"]:
                    st.caption(h["desc"])
                if h["renvoi"]:
                    st.button(f"Ouvrir la région {REGIONS[h['renvoi']]['nom']}", key=key(rid, "go", h["id"]),
                              on_click=goto, args=(h["renvoi"],))
            continue
        titre = f"{h['nom']} : {pct(r['pre'])} → {pct(r['post'])}" if r["k"] else f"{h['nom']} : {pct(r['pre'])}"
        with st.expander(titre, expanded=(i < 2)):
            if h["desc"]:
                st.caption(h["desc"])
            for t in tests:
                lp, ln = lrs(t)
                c1, c2, c3 = st.columns([6.5, 2.5, 1.5])
                c1.markdown(f"<div class='test-detail'><strong>{t['nom']}</strong>{badge(t['conf'])}</div>",
                            unsafe_allow_html=True)
                detail = " ".join(x for x in (t["how"] + "." if t["how"] else "",
                                              f"Positif si : {t['pos']}." if t["pos"] else "") if x)
                c1.caption(detail)
                extra = " ".join(x for x in (piege(t), t["note"]) if x)
                if extra:
                    c1.caption(extra)
                se_txt = f"Se {fr(t['se'])}, Sp {fr(t['sp'])}  \n" if t["se"] is not None else ""
                c2.markdown(f"<div class='chiffres'>{se_txt}LR+ {fr(lp, 1)}, LR− {fr(ln)}<br>"
                            f"<span class='pouvoir'>{pouvoir(t)}</span><br>"
                            f"<small>{t['src']}</small></div>", unsafe_allow_html=True)
                c3.selectbox("Résultat", RESULTATS, key=key(rid, "t", t["id"]), label_visibility="collapsed")
            for c in cprs:
                st.markdown("<div class='sep'></div>", unsafe_allow_html=True)
                st.markdown(f"**{c['nom']}**{badge(c['conf'])}", unsafe_allow_html=True)
                st.caption(f"{c['note']} Source : {c['src']}.".strip())
                if st.checkbox("Appliquer cette règle", key=key(rid, "c", c["id"], "on")):
                    for j, it in enumerate(c["items"]):
                        st.checkbox(it, key=key(rid, "c", c["id"], str(j)))
                    n = sum(bool(st.session_state.get(key(rid, "c", c["id"], str(j)))) for j in range(len(c["items"])))
                    lr, txt = cpr_lr(c, n)
                    st.markdown(f"**{n} sur {len(c['items'])} critères** : {txt}")
            n_res = sum(1 for t in tests if st.session_state.get(key(rid, "t", t["id"]), "—") != "—")
            if n_res >= 2:
                st.warning("Plusieurs tests de la même famille sont multipliés comme s'ils étaient indépendants, "
                           "ce qui surestime la probabilité. Une règle de prédiction est plus fiable.")

# ---------- synthèse ----------
with tab_syn:
    st.markdown("### Synthèse")
    if flags:
        for f in flags:
            st.markdown(f"<div class='red-flag {f['niveau']}'>{f['label']}<br>"
                        f"<span class='orient'>{f['orient']}</span></div>", unsafe_allow_html=True)
    else:
        st.caption("Aucun Red Flag coché.")
    st.altair_chart(chart_probas(rows), width="stretch")
    table = pd.DataFrame([dict(Hypothèse=r["nom"], **{"Pré-test": pct(r["pre"]), "Post-test": pct(r["post"]),
                                                       "Tests": r["k"]})
                          for r in sorted(rows, key=lambda r: -r["post"])])
    st.dataframe(table, hide_index=True, width="stretch")
    st.download_button("Télécharger le compte rendu (Markdown)",
                       rapport(R, flags, sorted(rows, key=lambda r: -r["post"]), tests_done, cpr_done),
                       file_name=f"bilan_{rid}.md", mime="text/markdown")
