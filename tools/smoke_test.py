"""Test de fumée hors Streamlit : stubs de streamlit/altair, exécution d'app.py
avec plusieurs états de session pour exercer tous les chemins de code."""
import runpy, sys, pathlib
from unittest.mock import MagicMock

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
try:
    import pandas  # noqa
except ImportError:
    sys.modules["pandas"] = MagicMock()
sys.modules.setdefault("altair", MagicMock())


class SS(dict):
    pass


def make_st(state):
    st = MagicMock()
    st.session_state = SS(state)
    st.tabs.side_effect = lambda labels: [MagicMock() for _ in labels]
    st.columns.side_effect = lambda spec: [MagicMock() for _ in range(spec if isinstance(spec, int) else len(spec))]
    st.radio.side_effect = lambda label, options, key=None, **kw: st.session_state.get(key, options[0])
    st.selectbox.side_effect = lambda label, options, key=None, **kw: st.session_state.get(key, options[0])
    st.checkbox.side_effect = lambda label, key=None, **kw: bool(st.session_state.get(key, False))
    st.toggle.side_effect = lambda *a, **kw: False
    st.multiselect.side_effect = lambda *a, **kw: []
    st.text_input.side_effect = lambda *a, **kw: ""
    st.slider.side_effect = lambda label, lo, hi, val, key=None, **kw: st.session_state.get(key, val)
    return st


def run(state):
    sys.modules["streamlit"] = make_st(state)
    runpy.run_path(str(ROOT / "app.py"), run_name="__main__")
    return sys.modules["streamlit"]


from regions import REGIONS  # noqa: E402
n = 0
for rid, R in REGIONS.items():
    state = {"region": rid}
    run(state); n += 1                                   # état vide
    state = {"region": rid, rid + "_adjust": True}
    for f in R["red_flags"]:
        state[f"{rid}_rf_{f['id']}"] = True
    for q in R["questions"]:
        state[f"{rid}_q_{q['id']}"] = q["opts"][0][0]
    for t in R["tests"]:
        state[f"{rid}_t_{t['id']}"] = "Positif"
    for c in R["cpr"]:
        state[f"{rid}_c_{c['id']}_on"] = True
        for i in range(len(c["items"])):
            state[f"{rid}_c_{c['id']}_{i}"] = True
    run(state); n += 1                                   # tout renseigné
print(f"{n} exécutions sans erreur")
