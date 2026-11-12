# Data sources & how the data team gets real rasters

Run first: `python data/scripts/00_verify_sources.py` (needs internet). Write results here.

The optional NASA Open API key is read from the `NASA_API_KEY` environment
variable and is used only for `api.nasa.gov` verification requests. Do not put
the real key in source files or commit it. In PowerShell, set it for the
current terminal session with:

```powershell
$env:NASA_API_KEY = "<your-new-key>"
python data/scripts/00_verify_sources.py
```

The key pasted into chat should be revoked and regenerated before use. The
`.env.example` file is documentation only; it is not loaded automatically.

| Need | Where to look | Format we need | Status |
|---|---|---|---|
| Elevation (TRUE metres) | Mars Trek (export/download), USGS Astrogeology downloads, HiRISE DTM list, PDS Geosciences | GeoTIFF, metres | **REAL (2026-11-11)**: USGS Mars 2020 TRN CTX DTM, 20 m, DOI 10.5066/P906QQT8 — `data/raw/jezero_ctx_dem.tif` (9.3 MB). The old MOLA 463 m crop was the coarse fallback and is retired (see below). |
| Imagery | Mars Trek layers (CTX / HiRISE mosaics), USGS | GeoTIFF or picture | **REAL (2026-11-11)**: USGS Mars 2020 TRN CTX orthoimage mosaic, 6 m, DOI 10.5066/P9GV1ND3 — `data/raw/jezero_ctx_ortho.tif` (35 MB). Plus 7 PIA gallery JPEGs + 3 POV JPEGs in `data/processed/jezero_delta/media/`. |
| Science sites | NASA Mars 2020 (Perseverance) mission pages, papers, Mars Trek | sites.csv rows + source_url | **REAL (2026-11-11)**: 10 sites in `data/inputs/jezero_delta/sites.csv`, every row with a source_url; 3 have no published coordinates (Bright Angel, Cheyava Falls, Broom Point) and are stored with lat/lon null + `location_not_published: true`. |
| POV images | Perseverance raw images page | pov.csv rows | **REAL (2026-11-11)**: 3 POV images (PIA26368 Cheyava Falls WATSON sol 1212; PIA26336 + PIA26369 Bright Angel). Only rover photos taken AT the site. |
| Bangladesh craters | USGS Gazetteer of Planetary Nomenclature | already in data/bangladesh_craters.json | **All 5 verified 2026-11-11** (planetocentric +East, MDIM 2.1): Bogra Feature 795 (-24.16, 331.20) and Sripur Feature 5677 (-30.74, 259.29) were corrected in `data/regions.yaml` (old values were planetographic); Ruhea Feature 15527 (-43.26, 173.08) was already correct; Teknaf 16045 and Satkania 16048 re-confirmed. |

## Verification notes (2026-10-31)

- Mars Trek, USGS, PDS Geosciences, HiRISE DTM landing page, and the Mars
  2020 raw-image portal were reachable.
- `https://api.nasa.gov/mars-wmts/catalog` returned HTTP 404 and is not an
  active dependency.
- The PDS Mars 2020 archive confirms public rover camera bundles and a
  Perseverance Analyst's Notebook; these are candidate sources for verified
  site/POV records.
- `data/raw/jezero_dem.tif` was a real 43 x 43 crop from the USGS-hosted
  MGS MOLA global DEM. It was an honest coarse fallback, not a substitute for a HiRISE/CTX local DTM.
  **Retired 2026-11-11**: replaced by the CTX 20 m DTM (see the 2026-11-11 section below); the file is no longer referenced.
- `data/processed/jezero_delta/` was rebuilt from that MOLA DEM on 2026-10-31. Imagery,
  verified science-site records, hazards, and POV media were MISSING then; **all are now REAL — see the 2026-11-11 section below**.

**Warning:** Mars Trek "DEM grayscale" web tiles are 8-bit pictures. Do NOT compute slope from them. Use a real elevation GeoTIFF.
Pick the finest elevation product that covers the box. Record: mission, instrument, product name, resolution, date, URL -> goes in `data/regions.yaml` (dem:/image: blocks) and shows in the app's "Data sources" tab.
Check coverage FIRST (a footprint layer on Mars Trek) before promising any region.

## Status of the layers (honest table — updated 2026-11-11, Jezero real-data build)
| Layer | In repo today | To make it real |
|---|---|---|
| Elevation / slope | **REAL**: CTX 20 m DTM resampled to a 50 m grid (400×400, `data/processed/jezero_delta/dem.npy`); 0% no-data — the whole 20 km box is inside CTX coverage, so all 160,000 cells are MEASURED, none DERIVED edge-fill. Anchors verified: landing −2,568.9 m (published −2,570), floor −2,598.3 m (~−2,600), Belva −2,489.1 m (−2,489), Kodiak centre −2,526.6 m (−2,527). | HiRISE 1 m DTM (DOI 10.5066/P13CPYYU, 5.3 GB) — MISSING, future upgrade. |
| Optical imagery | **REAL**: CTX 6 m ortho mosaic resampled onto the same 50 m grid (`imagery.png`); 7 PIA gallery JPEGs in `media/`. | HiRISE 25 cm ortho (6.9 GB) — MISSING, future upgrade. |
| Chemical index | **REAL (zone-mapped)**: carbonate wt% midpoints per zone (Z1 <5, Z2 3–9, Z3 6–16 wt%) stored as wt%/20 in `chem.npy`; Z4/Z5/Z6 = NaN (no published carbonate). Labelled "zone-mapped rover composition (wt%), not a spectrometer map". | Per-pixel spectrometer map (CRISM) — not used; CRISM index 0–0.11 is never wt%. |
| Radiation / space weather | ILLUSTRATIVE placeholders (config.py); optional live NASA DONKI solar events | MSL RAD surface dose rates; keep DONKI labelled as near-Earth solar events |
| Sites / hazards / POV | **REAL**: 10 sites (7 with coordinates, 3 location-not-published), 9 hazards (Neretva channel + 8 measured-DEM steep-slope clusters), 3 POV images, Z1–Z6 geology polygons (approximate). | None for this scope. |
| Bangladesh craters | Real names, diameters, approval years; **all 5 coordinates now verified in the Gazetteer**; SYNTHETIC rim-window terrain | Real DEM if one exists |

## 2026-11-11 Jezero real-data build — what changed and how it was verified

**Downloads** (full manifest: `data/downloads_manifest.json` — file, source URL, date, size, SHA-256, licence):
- CTX DTM: `data/raw/jezero_ctx_dem.tif`, 9,662,387 bytes, SHA-256 `16a1aa66…2327b`, DOI 10.5066/P906QQT8. Coverage verified with rasterio: lon 77.1605–77.6990, lat 18.2110–18.7212, 1596×1512 @ 20 m, zero nodata pixels.
- CTX ortho: `data/raw/jezero_ctx_ortho.tif`, 36,269,402 bytes, SHA-256 `842b457a…99b8615`, DOI 10.5066/P9GV1ND3, 5322×5040 @ 6 m, same coverage.
- 7 PIA JPEGs (PIA23239, PIA24814, PIA26140, PIA24379, PIA25673, PIA26336, PIA26639) downloaded from NASA's photojournal asset host `assets.science.nasa.gov` — the old `photojournal.jpl.nasa.gov/jpeg/PIAxxxxx.jpg` links now 301-redirect to a generic page, so the asset-host URLs are the working download links. All 7 verified as real JPEGs (dimensions in the manifest).
- PIA26368 (Cheyava Falls, WATSON, 1648×1200) and PIA26369 (Bright Angel panorama, 27000×6600, 23.6 MB — half-scale of the 54000×13200 full panorama) **do** have downloadable files at quality on the asset host, verified 2026-11-11. The research pack catalogued both as "no downloadable asset at quality"; that is now out of date, so both are attached as POV images in `pov.csv`. Neither was upscaled from a thumbnail.
- PIA page metadata was re-checked against the live photojournal pages. Two publish dates in the research pack are capture dates, not publish dates: PIA26336 published **2024-06-13** (image captured 2024-06-06, sol 1172); PIA26368 published **2024-07-25** (captured 2024-07-18, sol 1212); PIA26369 published **2024-07-25** (captured 2024-06-12, sol 1178). The manifest uses the publish dates.

**Pipeline route used (i)**: the real GeoTIFF downloaded, so `run_all.py --region jezero_delta` ran the existing 02_build_region.py. Grid is 50 m (400×400) — a 50 m resample of a 20 m source, recorded in meta.json warnings; 20 m detail is never claimed from the 50 m grid. The 128×128 attached-grid fallback (route ii, ~250 m effective source) was NOT needed. New scripts: `05_build_hazards.py` (steep-slope clusters from the measured DEM), `06_build_chemistry.py` (zone-mapped carbonate), `07_build_geology.py` (Z1–Z6 polygons), shared zone definitions in `jezero_zones.py`. `03_build_sites.py` now accepts empty lat/lon (only with `location_not_published=true`), enforces a source_url on every site, carries geology/science_purpose/chemistry/chem_index, and refuses to save a non-image POV download.

**MOLA retired**: the old MOLA 463 m block was removed from `data/regions.yaml`. The old `data/raw/jezero_dem.tif` (43×43 MOLA crop) is still on disk but no longer referenced by any region; delete it when convenient. MOLA was the coarse fallback, never a substitute for a local DTM.

**Elevation route (i) chosen — reasoning**: the GeoTIFF downloaded on the first try and covers the whole box, so no fallback was needed and no effective-resolution compromise was made. The DEM that ships is MEASURED (160,000/160,000 cells), never synthetic.

**Bangladesh verification (2026-11-11)**: queried the Gazetteer feature pages + the full search-results dump (planetocentric, +East, MDIM 2.1). Bogra Feature 795: centre −24.16, 331.20, 21.31 km, 1976 — regions.yaml had −24.4/331.1 (planetographic), **fixed**. Sripur Feature 5677: centre −30.74, 259.29, 22.99 km, 1991 — regions.yaml had −31.1/259.2 (planetographic), **fixed**. Ruhea Feature 15527: −43.26, 173.08, 9.5 km, 2016-10-18 — already correct, status flipped to verified. Teknaf 16045 (−36.11, 214.30) and Satkania 16048 (−32.35, 338.20) re-confirmed. No Jezero data was put on them. Note: the Gazetteer shows several control networks per feature; the MDIM 2.1 planetocentric values were used throughout (same network as the previously verified Teknaf/Satkania).

**Resolved 2026-11-11 (backend agent + coordinator verification)**: the guard is in place — `POST /api/route` with `goal_site_id` pointing at a null-coordinate site returns HTTP 400 ("has no published location — cannot route to it"), verified live and in `backend/scripts/validate.py` check 8. The frontend never plots them as markers and never offers them as route targets.

**Still MISSING (honest list)**:
- HiRISE 1 m DTM (DOI 10.5066/P13CPYYU, 5.3 GB) — not fetched; CTX 20 m covers the box.
- HiRISE 25 cm ortho mosaic (6.9 GB) — not fetched; CTX 6 m covers the box.
- MEDA line-by-line weather check — the research pack's MEDA values (pressure 718 Pa, −22/−83 °C) have not been re-checked line-by-line against the NASA source in this repo.
- 3D HUD terrain is still parametric (frontend scope, not data).
- PIA26476 elevation-graph image — not downloaded (values already in the DEM/sites).
