"""Logique clinique : rapports de vraisemblance, probabilités pré/post-test,
règles de prédiction clinique (CPR) et génération du compte rendu."""
from __future__ import annotations

import math

LR_MAX = 1000.0


def fr(x, d=2):
    """Nombre à la française (virgule décimale)."""
    if x is None:
        return "—"
    if math.isinf(x):
        return "∞"
    return f"{x:.{d}f}".replace(".", ",")


def pct(p, d=0):
    return f"{p * 100:.{d}f} %".replace(".", ",")


def odds(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return p / (1 - p)


def prob(o):
    return o / (1 + o)


def apply_lr(p, lr):
    return prob(odds(p) * min(lr, LR_MAX))


def lrs(t):
    """(LR+, LR−) d'un test : valeurs publiées si fournies, sinon calculées."""
    lp, ln = t.get("lrp"), t.get("lrn")
    se, sp = t.get("se"), t.get("sp")
    if se is not None and sp is not None:
        if lp is None:
            lp = se / (1 - sp) if sp < 1 else math.inf
        if ln is None:
            ln = (1 - se) / sp if sp > 0 else math.inf
    return lp, ln


def pouvoir(t):
    """Ce que le test permet réellement, d'après les LR (pas la seule Se/Sp)."""
    lp, ln = lrs(t)
    lp = None if lp is None else round(lp, 2)
    ln = None if ln is None else round(ln, 2)
    parts = []
    if lp is not None:
        if lp >= 10:
            parts.append("confirme fortement")
        elif lp >= 5:
            parts.append("confirme")
    if ln is not None:
        if ln <= 0.1:
            parts.append("exclut fortement")
        elif ln <= 0.2:
            parts.append("exclut")
    return "; ".join(parts) if parts else "peu discriminant seul"


def piege(t):
    """Avertit quand SnNout / SpPin ne tient pas au regard des LR."""
    lp, ln = lrs(t)
    lp = None if lp is None else round(lp, 2)
    ln = None if ln is None else round(ln, 2)
    se, sp = t.get("se"), t.get("sp")
    if se is not None and ln is not None and se >= 0.90 and ln > 0.2:
        return f"Sensibilité élevée mais LR− = {fr(ln)} : un test négatif n'exclut pas."
    if sp is not None and lp is not None and sp >= 0.90 and lp < 5:
        return f"Spécificité élevée mais LR+ = {fr(lp, 1)} : un test positif ne confirme pas."
    return ""


def cpr_lr(c, n):
    """LR retenu pour une règle de prédiction avec n critères positifs."""
    seuils = sorted(c["seuils"], key=lambda s: s[0])
    chosen = None
    for s in seuils:
        if n >= s[0]:
            chosen = s
    if chosen:
        k, lp, _ = chosen
        lr = lp if lp else 1.0
        crit = "critère" if k == 1 else "critères"
        txt = f"au moins {k} {crit} : LR+ {fr(lp, 1)}" if lp else f"au moins {k} {crit} : non informatif"
        return lr, txt
    k, _, ln = seuils[0]
    lr = ln if ln else 1.0
    quand = "aucun critère positif" if k == 1 else f"moins de {k} critères positifs"
    txt = f"{quand} : LR− {fr(ln)}" if ln else f"{quand} : non informatif"
    return lr, txt


def pretest(region, answers):
    """Probabilité pré-test heuristique : prévalence de départ × 1,5^score d'anamnèse.
    Outil pédagogique : ce n'est pas un modèle validé."""
    res = {}
    for h in region["hyps"]:
        s = 0.0
        for q in region["questions"]:
            i = answers.get(q["id"])
            if i is not None:
                s += q["opts"][i][1].get(h["id"], 0.0)
        res[h["id"]] = min(max(apply_lr(h["prev"], 1.5 ** s), 0.01), 0.95)
    return res


def posterior(pre, lr_list):
    o = odds(pre)
    for lr in lr_list:
        o *= min(lr, LR_MAX)
    return prob(o)


def sources_of(region):
    out = {}
    for t in region["tests"]:
        out.setdefault(t["src"], []).append(t["nom"])
    for c in region["cpr"]:
        out.setdefault(c["src"], []).append(c["nom"])
    return out


def rapport(region, flags, rows, tests_done, cpr_done):
    L = [f"# Raisonnement clinique : {region['nom']}", ""]
    L.append("## Red Flags cochés")
    if flags:
        L += [f"- [{f['niveau']}] {f['label']} → {f['orient']}" for f in flags]
    else:
        L.append("- Aucune")
    L += ["", "## Hypothèses (probabilité pré-test → post-test)"]
    for r in rows:
        L.append(f"- {r['nom']} : {pct(r['pre'])} → {pct(r['post'])}")
    L += ["", "## Tests réalisés"]
    if tests_done:
        L += [f"- {t['nom']} : {t['res']} (LR utilisé {fr(t['lr'])}) — {t['src']}" for t in tests_done]
    else:
        L.append("- Aucun")
    if cpr_done:
        L += ["", "## Règles de prédiction"]
        L += [f"- {c['nom']} : {c['n']} critères positifs ({c['txt']}) — {c['src']}" for c in cpr_done]
    L += ["", "_Outil pédagogique d'aide au raisonnement. Il ne remplace ni l'examen "
          "clinique ni le jugement du praticien. Les probabilités pré-test sont heuristiques._"]
    return "\n".join(L)
