# RedNav-399



Interplanetary Survival Guide: Martian Map — Jezero Crater, Mars.

An offline EVA route planner and helmet HUD built on measured NASA data, not
demo data. Plan a real walk across Jezero Crater, manage a real oxygen budget,
and analyse real rocks — then check every number against its source.

There is no hosted demo: the app is designed to run fully offline, the way
it would have to on Mars. Run it yourself — see Quick start.

What it does
Navigate Jezero. A layered map of the real crater (measured CTX imagery
and elevation) with 10 verified science sites. Plan a route between any two
points — the planner avoids steep ground and evidenced hazards, and tells
you the distance, walk time and oxygen on arrival.
Survive on oxygen. Oxygen is the health bar. Every route shows the
oxygen budget with reserve and round trip, from a real model.
Do science. The Research Lab measures a rock photo you upload —
measurements, similar-feature matches, novelty, hypotheses, next actions and
honest unknowns — entirely offline. The Science Pod (Sample Lab, Biosignature
Bench, Weather Station, Oxygen Plant, Map Table, Collection Wall) and the
Research Pond (a closed collect area on the ancient lakebed, 6 real rock
types, dry — no liquid water) turn collecting into research. The Pod is a
game building — Perseverance has no habitat in Jezero; the science inside
is real.
A living crew. Three astronauts — Amara (geologist), Jonas (engineer),
Priya (rover driver) — work their own jobs around the crater while you walk
yours.
Junior mode. The same world as a game for young explorers: drive the
rover, zap rocks with the SuperCam laser, collect real rocks, and solve the
real unsolved mystery of Cheyava Falls — without ever faking the answer.
Helmet HUD. First-person EVA view with compass tape, real Mars air
(718 Pa), oxygen and route gauges, radar and a glowing direction path.
The numbers (verified, traceable)
Ground	USGS CTX 20 m DTM, 400×400 cells @ 50 m, 100% measured
Landing → Kodiak	4,707.7 m, ~98 min walk, 77.5% oxygen on arrival
Sites	10 real sites with source URLs
Hazards	9, all evidenced (Neretva channel + measured steep-slope clusters)
Air	CO₂ 95.1%, 718 Pa, −22 / −83 °C (MEDA)
Oxygen made on Mars	MOXIE: 122 g total, 12 g/h peak, 98%+ pure
Every value traces to a NASA/USGS source in docs/DATA_SOURCES.md. Where no
published value exists, the app says so.

Quick start
bash


pip install -r backend/requirements.txt -r data/requirements.txt
python data/scripts/run_all.py --region jezero_delta
(cd backend && python -m uvicorn app.main:app --port 8000 --reload) &
(cd frontend && cp .env.example .env.local && npm install && npm run dev)
Open http://localhost:3000 — that is the app. Port 8000 is the API only.

Share it with your team: on Windows, double-click share.bat — it starts
both servers and prints a http://<LAN-IP>:3000 link for the same Wi-Fi.
For a public link, run share-public.bat (Cloudflare Tunnel).

Run it fully offline
Everything the app needs is in the repo: the measured CTX DEM and orthoimage,
the PIA photos, the Research Lab seed archive, and the downloaded models
(backend/app/brain/models/, gitignored — re-download from
backend/app/brain/models/MODEL_MANIFEST.md on Earth before you go). No
runtime downloads, no cloud, no API key. Turn the network off and it all still
works — routes, telemetry, missions and the Research Lab.

Data & sources
Data	Source
Terrain (20 m DTM)	USGS Mars 2020 TRN CTX DTM — DOI 10.5066/P906QQT8
Imagery (6 m ortho)	USGS Mars 2020 TRN CTX ortho — DOI 10.5066/P9GV1ND3
Photos	NASA Photojournal (PIA23239, PIA24814, PIA26140, PIA24379, PIA25673, PIA26336, PIA26639, PIA26368, PIA26369)
Atmosphere	NASA NSSDC Mars Fact Sheet; Perseverance / MEDA
Chemistry	SuperCam (Wiens et al. 2022); carbonate (Clavé et al. 2026)
Verify the numbers yourself
bash


python backend/scripts/validate.py        # 12 checks, all PASS
python -m pytest backend/tests -q         # 38 tests
cd frontend && npx tsc --noEmit && npm run build
Full evidence: docs/VALIDATION.md.

Project structure


backend/   FastAPI: regions, layers, sites, A* route planner, oxygen model
data/      pipeline: NASA/USGS rasters -> slope / hillshade / hazard layers
frontend/  Next.js 15 helmet HUD + layered map + 3D EVA view
docs/      project context, data sources, API spec, validation evidence
share.bat  start both servers and print the LAN link (Windows)
Tech stack
FastAPI · Next.js 15 · React · Three.js · SQLite (local only) · ONNX +
classical computer vision (Research Lab measuring) · Qwen2.5-0.5B (optional
local narration; Ollama / Odysseus for Tier 1/2)

Honesty rules
No fake data shown as real. Missing data is shown as MISSING.
The 3D scene is a visualisation, not measured data.
Cheyava Falls is a potential biosignature — not confirmed life.
Radiation stays ILLUSTRATIVE. Never "safe" — "below the slope limit in the
data used".
No coordinates are given for Cheyava Falls, Bright Angel or Broom Point —
none are published.
AI disclosure: AI tools built this solution from the team's verified Jezero
research pack. A small local language model (Qwen2.5-0.5B) only turns
measurements into plain-language narration; the measurements come from the
local pipeline and published NASA data. No science value was generated by AI,
and no AI-generated images are used — all Mars photos are real NASA images.
