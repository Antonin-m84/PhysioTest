from . import epaule, genou, atm, lombaire, cervicale, cheville, hanche, main

REGIONS = {m.REGION["id"]: m.REGION
           for m in (epaule, genou, atm, lombaire, cervicale, cheville, hanche, main)}
