"""Enregistre le rendu des cartes Build Your Rehab (pages construites en JavaScript).

Usage :
    pip install playwright && playwright install chromium
    python tools/dump_byr.py

Produit le dossier byr_dump/ avec, pour chaque région, le HTML rendu, le texte visible
et tous les fichiers .js/.json chargés (c'est là que se trouvent les données des cartes).
"""
import pathlib
import re

from playwright.sync_api import sync_playwright

BASE = "https://buildyourrehab.netlify.app"
PAGES = ["epaule", "genou", "atm", "lombaire"]
out = pathlib.Path("byr_dump")
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    ressources = set()
    page.on("response", lambda r: ressources.add(r.url) if re.search(r"\.(js|json)(\?|$)", r.url) else None)
    for name in PAGES:
        page.goto(f"{BASE}/{name}/", wait_until="networkidle")
        (out / f"{name}.html").write_text(page.content(), encoding="utf-8")
        (out / f"{name}.txt").write_text(page.inner_text("body"), encoding="utf-8")
    for url in sorted(ressources):
        if "buildyourrehab" not in url:
            continue
        nom = re.sub(r"[^\w.]+", "_", url.split("//", 1)[1])
        (out / nom).write_bytes(page.request.get(url).body())
    browser.close()
print("Terminé :", out.resolve())
