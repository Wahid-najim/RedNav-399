# API (FastAPI, http://localhost:8000, docs at /docs)

| Method | Path | Returns |
|---|---|---|
| GET | /api/health | `{ok, regions_ready[]}` |
| GET | /api/regions | `[{id,name,role,center}]` |
| GET | /api/regions/{id} | meta: grid, layers[] (provenance), warnings, defaults, layer_urls, stats |
| GET | /api/regions/{id}/sites | science sites (+ pov_images) |
| GET | /api/regions/{id}/hazards | analyst-marked hazards |
| GET | /api/regions/{id}/geology | geological feature polygons (lat/lon) |
| GET | /api/space-weather | radiation / solar-activity safety context (ILLUSTRATIVE unless live DONKI is enabled) |
| GET | /api/regions/{id}/layers/{imagery\|hillshade\|slope\|hazard\|chemical}.png | layer picture (404 if missing) |
| GET | /api/regions/{id}/media/{file} | POV images |
| POST | /api/route | see below |

`POST /api/route` body: `{region_id, start:{lat,lon}, goal_site_id | goal:{lat,lon}, via_site_ids[], max_slope_deg?, caution_slope_deg?, walk_speed_ms?, load_factor?, science_stop_min?, obstacles:[{lat,lon,radius_m}]}`
Returns `insights[]` (context warnings), `direct_line`, `assumptions`, and `routes[]` (balanced / safest / shortest_feasible; each: points[], distance_m, max/mean_slope_deg, elev_gain_m, walk_time_min, mission_time_min, reasons[], assumptions), `nearby_science[]`, `warnings[]`, `disclaimer`.
Rules: unknown (NaN) cells and cells over the slope limit are blocked; no route => `found:false`, never a fake line.

## Processed-data contract (data/processed/<region>/)
meta.json · dem.npy (float32 m, NaN=no data, row0=north) · slope.npy · imagery.png · hillshade.png · slope.png · hazard.png · sites.json · hazards.json · media/
Coordinates: lat deg, lon deg EAST 0-360.

## Added fields (route response)
Each found route also has: `safety.oxygen` (walk/stop/one-way/round-trip use %, remaining %, reserve, ok flags), `safety.radiation` (synthetic placeholder dose), per-point `t_min` and `o2_used_pct`, and `explanation` = {data_used[], obstacles{near_route[], blocked_steep_cells,...}, science_destination{}, why_alternatives[], evidence[], missing_data[], route_statement}.
`nearby_science[]` now = real A* detours: `{id,name,reachable,extra_distance_m,extra_time_min,why_interesting,geology,chemical_index,considerations[]}`.
Region meta adds `suit_assumptions`, `crs`, `layer_urls.chemical`; `/api/regions` adds `synthetic`, `bangladesh{}` facts, `coord_status`.
Optional processed files: `chem.npy`/`chemical.png` (0..1, NaN = no coverage), `geology.json`.
Env: `REDNAV_LIVE_SPACE_WEATHER=1` + `NASA_API_KEY` adds recent solar flares from NASA DONKI (untested without internet; falls back honestly).

## Research Lab (offline scientific instrument, Jezero Crater)

Image-upload-only decision helper (not a chatbot, not a discoverer). All
measuring is done by the always-on classical-CV + ONNX pipeline
(numpy + Pillow Otsu segmentation, MobileSAM ONNX optional); a small
language model only writes plain-language explanations, via a localhost
model server (Odysseus / Ollama-style) when one is reachable. No network
calls at run time except to localhost. Storage is local SQLite only
(`backend/data/research_lab.db`, gitignored); no cloud, no API key, no telemetry.

| Method | Path | Returns |
|---|---|---|
| GET | /api/brain | `{tier, tier_name, brain, model\|null, ram_mb, available, requested_tier, odysseus_reachable, ollama_reachable, models_on_disk[], notes[]}` — the UI badge reads this |
| POST | /api/brain/tier | body `{tier: 1\|2\|3}` → effective tier (auto-drops when RAM is over budget or no localhost model server is reachable; the drop is reported in `notes`, never silent). Other values → 400 |
| POST | /api/analyze-image | multipart `image` (PNG/JPG/TIFF, ≤25 MB) + optional `sol, instrument, lat, lon, note` (never auto-filled; missing → "not provided") → 201 with the full analysis object |
| GET | /api/analyses | `[{id, created_at, filename, tier}]`, newest first |
| GET | /api/analyses/{id} | full analysis object |
| GET | /api/analyses/{id}/image | the uploaded image file |
| GET | /api/analyses/{id}/bundle | ZIP evidence bundle (see below) |

Tiers (low-RAM budget, Section 2b: any loaded model ≤1.5 GB RAM, app+brain ≤3 GB total, CPU-only):
Tier 1 Full = Odysseus local models over localhost; Tier 2 Light = 0.5B narrator + ONNX/classical-CV;
Tier 3 Minimal = ONNX/classical-CV only, no language model. One model loaded at a time, ever.
RAM is read from `/proc/meminfo` + `/proc/self/status` (stdlib only, no psutil).
`ODYSSEUS_MODEL_URL` (default `http://localhost:11434/api`) and `ODYSSEUS_WORKSPACE_URL`
(default `http://localhost:7000`) configure the localhost probes.

Analysis object (in order): `measurements[]` (`{name, value, unit, method, uncertainty}`),
`matches[]` (`{name, score, metric, shared_properties[], archive_ref, thumbnail_url|null}` — cosine
similarity in a 6-dim descriptor space; below 0.5 → `no_match_note: "No confident match in the
local archive"`, never the least-bad match), `novelty` (`{score_sigma, population, n, method, plain}` —
Jezero zones reference population, n = 6, small population, say so; high ≠ new/important/biosignature),
`hypotheses[]` (`{text, supporting_measurements[], citation:{author, year, title, source_file}, confidence}` —
only from the local literature index; no citation → goes to Unknowns, never invented),
`actions[]` (`{rank, action, cost, expected_value, cost_unknown}` — ranked by expected value / cost;
"Do nothing — archive and move on" always present; cost-unknown actions have `rank: null`, never ranked first),
`unknowns[]` (never empty; always includes "Absence from the local index is not absence from Mars."),
`pattern_finder` (`{pairs:[{a, b, count, expected, note}], label}` — local co-occurrence implementation,
inspired by the co-occurrence idea behind PathCORE-T; never called "PathCore"),
`plain_summary` (one sentence), `manifest`, `onnx_segmentation` (or null), `brain_explanation` (or null, labelled "model output").
Deterministic: the same image twice gives identical measurements (seed 42 logged in the manifest).

Bundle ZIP (`/api/analyses/{id}/bundle`): `analysis.json`, `report.md` (human-readable, same six
sections in order), the uploaded image, `manifest.json` (every model/version/hash/source used,
archive source, tier, seed). Enough for a second scientist to reproduce the result without this app.

Seed archive: `backend/app/archive/jezero_seed.json` (T1–T13 + Z1–Z6 transcribed from
`jezeroVerified.ts`; every value carries a source pointer). Verified by
`backend/scripts/verify_archive.py` (595 numeric tokens checked against the TS; Belva
coordinates/elevation and the archive descriptor vectors are labelled non-TS/estimated).
Where the TS and the PDFs disagree, the PDFs win — but only the TS was on disk in this
sandbox, so no PDF cross-check was possible (see `docs/VERIFICATION_LOG.md`).

## Routing guard: sites with no published location

`POST /api/route` with `goal_site_id` or any `via_site_ids` resolving to a site whose
`lat`/`lon` is null or missing (Bright Angel, Cheyava Falls, Broom Point — no published
coordinates) returns **400 "site … has no published location — cannot route to it"**.
Null-lat sites are also skipped (never crash) in nearby-science detours, hazard
distance checks, `hazard_mask`, and `chem_at`.
