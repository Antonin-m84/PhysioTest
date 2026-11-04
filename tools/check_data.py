"""Vérifie la cohérence des données : références croisées, bornes, doublons."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from regions import REGIONS
from core import lrs

ok = True
for rid, r in REGIONS.items():
    hy = {h["id"] for h in r["hyps"]}
    ids = [x["id"] for k in ("red_flags", "hyps", "questions", "tests", "cpr") for x in r[k]]
    for k in ("red_flags", "hyps", "questions", "tests", "cpr"):
        loc = [x["id"] for x in r[k]]
        if len(loc) != len(set(loc)):
            ok = False; print(rid, "doublon dans", k)
    for t in r["tests"]:
        if t["hyp"] not in hy: ok = False; print(rid, "test hyp inconnue", t["id"], t["hyp"])
        if t["se"] is not None and not (0 <= t["se"] <= 1 and 0 <= t["sp"] <= 1): ok = False; print(rid, "Se/Sp hors bornes", t["id"])
        if lrs(t) == (None, None): ok = False; print(rid, "aucun LR", t["id"])
    for c in r["cpr"]:
        if c["hyp"] not in hy: ok = False; print(rid, "cpr hyp inconnue", c["id"])
    for q in r["questions"]:
        for lab, w in q["opts"]:
            for h in w:
                if h not in hy: ok = False; print(rid, "question", q["id"], "hyp inconnue", h)
    n_v = sum(t["conf"] == "V" for t in r["tests"]); n = len(r["tests"])
    print(f"{r['nom']:<16} red_flags={len(r['red_flags']):>2} hyp={len(r['hyps']):>2} questions={len(r['questions'])} tests={n:>2} (vérifiés {n_v}) règles={len(r['cpr'])}")
print("OK" if ok else "ERREURS")
sys.exit(0 if ok else 1)
