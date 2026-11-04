"""Constructeurs compacts pour décrire une région.

conf : "V" = valeur retrouvée dans la source pendant la construction ;
       "M" = valeur issue de la mémoire du modèle, à revérifier avant usage.
niveau de Red Flag : "urgent" | "rapide" | "avis".
"""


def RF(id, label, orient, niveau="avis"):
    return {"id": id, "label": label, "orient": orient, "niveau": niveau}


def H(id, nom, prev, desc="", renvoi=None):
    return {"id": id, "nom": nom, "prev": prev, "desc": desc, "renvoi": renvoi}


def Q(id, texte, *opts):
    return {"id": id, "texte": texte, "opts": list(opts)}


def T(id, nom, hyp, se, sp, src, how="", pos="", conf="M", lrp=None, lrn=None, note=""):
    return {"id": id, "nom": nom, "hyp": hyp, "se": se, "sp": sp, "src": src,
            "how": how, "pos": pos, "conf": conf, "lrp": lrp, "lrn": lrn, "note": note}


def C(id, nom, hyp, items, seuils, src, conf="M", note=""):
    return {"id": id, "nom": nom, "hyp": hyp, "items": items, "seuils": seuils,
            "src": src, "conf": conf, "note": note}
