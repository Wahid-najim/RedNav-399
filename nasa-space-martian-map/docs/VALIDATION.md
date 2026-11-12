# Validation evidence (run 2026-11-11, Jezero real-data build)

Command: `python backend/scripts/validate.py` (REAL Jezero region — measured USGS CTX 20 m DTM, DOI 10.5066/P906QQT8), `python -m pytest backend/tests -q` (38 tests pass), `cd frontend && npx tsc --noEmit && npm run build` (clean).

```
PASS  layers aligned: grid 400x400 @ 50.0 m; rasters {'imagery.png': (400, 400), 'hillshade.png': (400, 400), 'slope.png': (400, 400), 'hazard.png': (400, 400), 'chemical.png': (400, 400)}
PASS  route reaches goal: 1 route(s) found, balanced 4707.7 m, max slope 5.2 deg, no cell over the limit
PASS  obstacle changes route: baseline 4707.7 m -> 4707.7 m after blocking the route midpoint (path changed: True)
PASS  slope limit changes route: limit 20 deg: 4707.7 m; limit 3 deg: no route m
PASS  missing data visible: 32171 chemical cells have NO coverage (returned as None, drawn grey); 3 sites have no published location (Bright Angel, Cheyava Falls, Broom Point); BD craters report 'rover photos: MISSING' (0 images)
PASS  travel-time / oxygen assumptions explained: walk 98.1 min -> 196.2 min with 2x cargo; O2 on arrival 77.5%, after return 56.2% (reserve 25.0%)
PASS  5 Bangladesh regions route: Bogra, Sripur, Teknaf, Ruhea, Satkania: base -> rim route found in each (SYNTHETIC terrain, coordinates verified in IAU Gazetteer)
PASS  null-location site not routable: route to Cheyava Falls (no published coordinates) -> HTTP 400
PASS  DEM anchors vs published values: landing 18.4446N 77.4509E: -2568.9 m (published -2570, tol ±5); crater floor 18.38N 77.45E: -2598.3 m (published -2600, tol ±10); Belva centre 18.48N 77.38E: -2489.1 m (published -2489, tol ±5); Kodiak centre 18.4124N 77.3820E: -2526.6 m (published -2527, tol ±5)
PASS  provenance is MEASURED CTX: mission=Mars Reconnaissance Orbiter, instrument=CTX, resolution=20.0 m, synthetic=None
PASS  Research Lab offline analysis: POST /api/analyze-image -> 201, sections present, 21 measurements, 7 unknowns, brain tier 3 (ONNX/classical-CV pipeline only (no language model))
PASS  evidence bundle complete: bundle ZIP for analysis 4a1b821cf245: ['analysis.json', 'image.png', 'manifest.json', 'report.md']

ALL PASS
```

Notes on two checks that look odd and are correct:
- **Obstacle check:** the distance stays 4707.7 m because on this gentle floor terrain many minimal-step paths have identical length — but the path itself changes (verified directly against the A* output: the two 79-point paths differ, and no detour path cell falls inside the blocked circle). A 2000 m obstacle at the same point lengthens the route to 6278.4 m.
- **Slope-limit check:** a 3° limit makes landing → Kodiak unroutable (no route), which is the correct behaviour, not a failure.

## Live API smoke test (real uvicorn server, 2026-11-11)
- `GET /api/health` → ok, 7 regions ready (5 BD + demo_synthetic + jezero_delta).
- `GET /api/regions/jezero_delta/sites` → 10 sites (7 with coordinates, 3 null-location).
- `POST /api/route` landing → Kodiak → balanced 4707.7 m; route to Cheyava Falls → HTTP 400 (the null-coordinate guard works).
- `POST /api/analyze-image` (320×240 test image, sol 1212, Mastcam-Z) → 201 in 6.5 s: 21 measurements, 5 matches (top Bright Angel 0.9584, labelled model output), novelty 7.89σ (n = 6), 1 hypothesis, 5 actions, 6 unknowns, plain summary present. `GET /api/analyses/{id}/bundle` → ZIP with analysis.json, report.md, image.png, manifest.json.
- `GET /api/brain` → tier 3 Minimal, Odysseus and Ollama unreachable, models on disk listed (Qwen2.5-0.5B GGUF + 2 MobileSAM ONNX).

## Low-RAM check (target machine: MSI Modern 14, i3-1215U, 8 GB RAM, no GPU)
- Backend process: **71 MB RSS idle, 206 MB RSS during/after an analysis** (includes onnxruntime + MobileSAM encoder).
- Largest model file on disk: Qwen2.5-0.5B-Instruct Q4_K_M GGUF, **491,400,032 bytes (~469 MB) — under the 1.5 GB cap**. MobileSAM encoder 28 MB + decoder 16.5 MB.
- App + brain total is well under the **3 GB budget** in this VM (backend ~200 MB; the Next.js frontend build is 108 kB first-load JS, served static).
- **Tier 3 (Minimal) verified working end-to-end** (analysis above). Auto-drop to Tier 3 verified: with no model server reachable the brain reports tier 3 and analyses still complete. **Tier 1 (Full) and Tier 2 (Light) with a live language-model server were NOT verified here** — no llama.cpp/Ollama runtime is installed in this VM, so the Qwen GGUF could not be loaded and the tier-switch path with a real server is untested. That must be checked on Aizen's machine before the demo.
- This VM has only ~1.3–1.6 GB RAM available during the run (8 GB total, shared); the numbers above are process RSS, not whole-machine totals.

## PDF cross-check (2026-11-11)
The two Jezero PDFs were read directly with pypdf and spot-checked against the values in the code: 14-page values tables, 28-page research pack. 16/17 key values confirmed present (CO2 95.1%, H2O 210 ppm, 718 Pa, −22/−83 °C, MgO 21.4 wt%, MOXIE 122 g, landing −2,570 m at 18.4446/77.4509, carbonate 6–16 wt%, Cheyava Falls 1.0 × 0.6 m, sol 1212, 45 km, olivine 41.1 wt%, MOXIE 12 g/h). The one miss was a dash-encoding variant — the value is present as "6-16". No disagreement found between the PDFs and `jezeroVerified.ts` on the checked values. PIA26368/26369 capture dates in the pack (2024-07-18 / 2024-06-12) vs publish dates in the download manifest (2024-07-25) are different fields, not a disagreement. The archive seed file was also verified separately: `python backend/scripts/verify_archive.py` — 595 numeric tokens checked against jezeroVerified.ts, all found.

## Plain-language check
By design, not automated: every telemetry number has a plain-English "what this means" line, science terms have one-tap "What is this?" explainers (glossary), HUD Level 1 is the simple game view (default) and Level 3 is full science detail. No automated check verifies every screen's wording — a human read-through is still needed.

## What this does NOT prove
- **WebGL 3-D scene** was not verified headless (the 3-D terrain component is unchanged from the parametric version — it does not yet use the measured DEM).
- **Live click-through** of the frontend against the running backend in a real browser was not done; the frontend Research Lab falls back to a clearly-labelled mock when the backend is unreachable.
- **Phone widths** not checked.
- **Live NASA DONKI call** not checked (no internet in the build sandbox at check time; the radiation numbers stay ILLUSTRATIVE).
- **Tier 1/2** with a live model server not verified (see low-RAM check).
- **MEDA line-by-line weather check** against the PDS4 bundle not done in this repo.
- Screenshots/GIFs for judges not produced.

## What this DOES prove
The Jezero region is real, measured, and traceable: CTX 20 m DTM (DOI 10.5066/P906QQT8), CTX 6 m ortho (DOI 10.5066/P9GV1ND3), 10 sites with source URLs, 9 evidenced hazards, zone-mapped carbonate chemistry (never CRISM index as wt%), 3 sites honestly stored with no published coordinates and never routable. Thresholds, the oxygen model and the radiation numbers are assumptions (config.py). Nothing synthetic in `jezero_delta` is presented as real.
