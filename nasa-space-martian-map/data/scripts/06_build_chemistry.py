"""Build the chemical layer (chem.npy + chemical.png) for jezero_delta.

  python 06_build_chemistry.py --region jezero_delta

Zone-mapped carbonate wt% (PUBLISHED ranges, Clavé et al. 2026 doi:10.1029/2025JE009107;
Science 2026 PIXL supplement): Margin Unit (Z3) 6-16 wt%, Upper Fan (Z2) 3-9 wt%,
Séítah (Z1) <5 wt%. The representative value per zone is the midpoint of its
published range (Z1 2.5, Z2 6.0, Z3 11.0 wt%). Stored as a 0..1 NORMALIZED index
(wt% / 20), the same scale the demo used, so the UI needs no change. Cells in
zones with NO published carbonate (Z4/Z5/Z6) are NaN = no coverage (grey, API
returns None) — never 0, never filled in.

The CRISM spectral index (0-0.11) is NEVER wt% and is never used here.
This is a zone-mapped rover composition layer, not a spectrometer map.
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import ROOT, PROCESSED, chem_rgba
from jezero_zones import ZONE_INFO, zone_masks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="jezero_delta")
    a = ap.parse_args()
    out = PROCESSED / a.region
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    g = meta["grid"]
    masks = zone_masks(g["height"], g["width"], g["north_lat"], g["west_lon"], g["cell_m"])
    chem = np.full((g["height"], g["width"]), np.nan, dtype="float32")
    coverage = {}
    for zid, info in ZONE_INFO.items():
        mid = info["carbonate_wt_pct_mid"]
        n = int(masks[zid].sum())
        coverage[zid] = n
        if mid is not None:
            chem[masks[zid]] = mid / 20.0
    np.save(out / "chem.npy", chem.astype("float32"))
    Image.fromarray(chem_rgba(chem), "RGBA").save(out / "chemical.png")
    # meta.json layer entry + honest warning
    meta["layers"] = [l for l in meta["layers"] if l.get("kind") != "chemical"]
    meta["layers"].append({
        "kind": "chemical", "name": "Carbonate (zone-mapped rover composition)",
        "mission": "Mars 2020 / Perseverance", "instrument": "SuperCam + PIXL (rover instruments)",
        "product": "Zone-mapped carbonate wt% (Clavé et al. 2026; Science 2026 PIXL supplement)",
        "resolution_m": g["cell_m"],
        "acquired": "rover sols 1-286 (SuperCam) and Margin Unit campaign",
        "nature": "static",
        "source_url": "https://doi.org/10.1029/2025JE009107",
        "limitation": "Zone-mapped rover composition (wt%), not a spectrometer map: each zone shows the "
                       "midpoint of its published carbonate range (Z1 <5 wt%, Z2 3-9 wt%, Z3 6-16 wt%), "
                       "stored as wt%/20. Zones with no published carbonate (Z4/Z5/Z6) have no coverage. "
                       "The CRISM spectral index (0-0.11) is not wt% and was not used.",
    })
    w = ("Chemical layer is zone-mapped from published rover composition ranges, not a "
         "per-pixel spectrometer map; boundaries are approximate zone polygons.")
    if w not in meta["warnings"]:
        meta["warnings"].append(w)
    w2 = ("Output grid is 50 m, resampled (bilinear) from the 20 m CTX DTM: detail finer "
          "than 50 m is interpolated, not real; the source resolution stays 20 m.")
    if w2 not in meta["warnings"]:
        meta["warnings"].append(w2)
    (out / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    cov = {z: f"{n} cells ({100*n/chem.size:.1f}%)" for z, n in coverage.items()}
    print(a.region, "chem.npy", chem.shape, "| normalised index range",
          f"{np.nanmin(chem):.3f}-{np.nanmax(chem):.3f}", "| NaN (no coverage)",
          f"{100*np.isnan(chem).mean():.1f}%", "| coverage", cov)


if __name__ == "__main__":
    main()
