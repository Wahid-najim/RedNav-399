# RedNav-N399 — NASA Space Apps 2026 · Interplanetary Survival Guide: Martian Map

Layered NASA-data map + Marswalk route planner + helmet HUD, for one chosen Mars region (plus 5 Bangladesh-named craters as extra selectable regions).

```
backend/   FastAPI: regions, layers, sites, A* route planner, travel time      (owner: backend)
data/      pipeline: NASA/USGS rasters -> slope/hillshade/hazard PNG + JSON     (owners: data team)
frontend/  Next.js helmet HUD + layered map (theme from the original RedNav)    (owner: frontend)
docs/      project context, tasks per person, data sources, API spec
prompt.md  master prompt for an AI coding agent to finish the project
```

## Run it in 3 commands
**Open http://localhost:3000 in your browser — that is the app. Port 8000 is the API only. Opening http://127.0.0.1:8000 in a browser shows the API status page, not the app.**
```bash
pip install -r backend/requirements.txt -r data/requirements.txt
python data/scripts/run_all.py --region jezero_delta   # REAL Jezero data (measured CTX 20 m DTM); --full-demo also rebuilds the synthetic demo + 5 bd_* craters
(cd backend && python -m uvicorn app.main:app --port 8000 --reload) &
(cd frontend && cp .env.example .env.local && npm install && npm run dev)   # http://localhost:3000
```
Real data: see `docs/DATA_SOURCES.md`. The Jezero region ships with real measured data already built in `data/processed/jezero_delta/` — no rebuild is needed to run it.

## Sharing with your team
- **Same Wi-Fi / LAN:** Run `share.bat` from the project root (on Windows). It starts both servers on `0.0.0.0` (ports `8000` and `3000`), verifies `/api/health`, and prints your `http://<LAN-IP>:3000` URL. All API requests proxy through Next.js (`/api/*` -> port `8000`), so your team only opens port `3000`. If prompted by Windows Defender Firewall, allow access on your Private network.
- **Public internet link:** With the servers running (via `share.bat`), run `share-public.bat` to open a Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:3000`), or run `ngrok http 3000`. Because `/api/*` proxies through port `3000`, one tunnel shares the full app including the map, route planner, and Research Lab.

## Run it fully offline (Mars has no internet)
Everything the app needs is in the repo: the measured CTX DEM and orthoimage (`data/raw/`, `data/processed/jezero_delta/`), the PIA photos (`data/processed/jezero_delta/media/`), the Research Lab archive seed (`backend/app/archive/jezero_seed.json`), and the downloaded models (`backend/app/brain/models/`, gitignored — re-download from `backend/app/brain/models/MODEL_MANIFEST.md` on Earth before you go). No runtime downloads, no cloud, no API key. To prove it: turn the network off, then run the same 3 commands above and use the app — routes, telemetry, missions and the Research Lab all work. The optional NASA DONKI solar-events call is the only network feature; with no network it is labelled unavailable and the radiation panel stays ILLUSTRATIVE.

## How to verify the numbers (for judges)
Every value is traceable: `docs/DATA_SOURCES.md` has the real-vs-missing table and the download manifest (`data/downloads_manifest.json` — file, source URL, date, size, SHA-256, licence). Run the checks yourself: `python backend/scripts/validate.py` (12 checks, all PASS on the real region), `python -m pytest backend/tests -q` (38 tests), `python backend/scripts/verify_archive.py` (595 numeric tokens checked against the source values). Full evidence: `docs/VALIDATION.md`.

## Honesty rules (from the NASA brief)
No fake data shown as real · every layer shows source/resolution/date · missing data is shown as MISSING · thresholds are labelled assumptions · never say "safe", say "below the slope limit in the data used".

## What is in the app (details: docs/FEATURES.md)
Layers: surface imagery · elevation/slope · chemical index · geological features · rover observations · hazards · routes (every layer shows source, resolution, missing data).
Route planner: 3 strategies (balanced / gentlest slopes / shortest feasible), travel time, **oxygen budget with reserve + round trip**, radiation/space-weather safety context, routed detours to science near the route, **Route Analysis window** (5 questions from the NASA brief), plain-language context warnings.
Interface: astronaut intro -> helmet HUD with 3 priority levels (keys 1/2/3), live warnings (oxygen, point of no return, steep ground ahead, hazards, science of interest).
Regions: Jezero (main) + Bogra, Sripur, Teknaf, Ruhea, Satkania (Bangladesh-named craters, shown on a Mars overview chart).
**Data status: the Jezero region (`jezero_delta`) is REAL measured data** — CTX 20 m DTM, CTX 6 m ortho, 10 sites with source URLs, 9 evidenced hazards, zone-mapped carbonate chemistry. The `demo_synthetic` region and the 5 Bangladesh craters are still SYNTHETIC and labelled so (docs/DATA_SOURCES.md).
