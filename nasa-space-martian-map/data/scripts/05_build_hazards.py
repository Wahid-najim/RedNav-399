"""Build hazards.csv for jezero_delta from EVIDENCE ONLY.

  python 05_build_hazards.py --region jezero_delta

Two sources, nothing invented:
  1. Neretva Vallis channel (hand-written row): 400 m wide channel [R12],
     marked at the published breach 18.4720N 77.3420E (repo POI, Z4).
     Radius 200 m = half the published channel width.
  2. Steep-slope zones from the MEASURED CTX DEM: connected clusters of
     cells steeper than the rover limit (20 deg, backend/app/config.py
     DEFAULT_MAX_SLOPE_DEG). Each cluster >= 20 cells becomes one hazard
     circle: centre = cluster centroid, radius = equivalent-circle radius
     sqrt(area/pi). Clusters smaller than 20 cells are not listed (too
     small to mark at this scale); the slope layer itself still shows them.
     No boulders: no published boulder catalogue exists for this box.

The output overwrites data/inputs/<region>/hazards.csv; 03_build_sites.py
then turns it into hazards.json. Re-run after any DEM rebuild.
"""
import argparse, csv, json, math
from pathlib import Path
import numpy as np
from scipy import ndimage
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import ROOT, PROCESSED

SLOPE_LIMIT_DEG = 20.0   # == backend/app/config.py DEFAULT_MAX_SLOPE_DEG
MIN_CELLS = 20           # ignore specks smaller than 20 cells (50,000 m^2 at 50 m)
MAX_ROWS = 8             # keep the list short: largest clusters only


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="jezero_delta")
    a = ap.parse_args()
    out = PROCESSED / a.region
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    g = meta["grid"]
    slope = np.load(out / "slope.npy")
    cell = float(g["cell_m"])
    steep = np.isfinite(slope) & (slope > SLOPE_LIMIT_DEG)
    lab, nlab = ndimage.label(steep)
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, index=np.arange(1, nlab + 1))
    clusters = []
    for i, size in enumerate(sizes, start=1):
        if size < MIN_CELLS:
            continue
        rr, cc = np.where(lab == i)
        r0, c0 = float(rr.mean()), float(cc.mean())
        lat = g["north_lat"] - (r0 * cell) / (3_396_190.0 * math.pi / 180.0)
        lon = g["west_lon"] + (c0 * cell) / (3_396_190.0 * math.cos(math.radians(lat)) * math.pi / 180.0)
        area_m2 = float(size) * cell * cell
        clusters.append({"cells": int(size), "lat": lat, "lon": lon,
                         "radius_m": math.sqrt(area_m2 / math.pi),
                         "max_slope": float(np.nanmax(slope[lab == i]))})
    clusters.sort(key=lambda c: -c["cells"])
    rows = [{
        "id": "neretva_channel", "name": "Neretva Vallis channel",
        "lat": 18.4720, "lon": 77.3420, "radius_m": 200,
        "reason": "Neretva Vallis channel, 400 m wide (published); steep incised channel wall — crossing the channel, not the floor, is the hazard.",
        "source_url": "https://www.nasa.gov/news-release/nasa-says-mars-rover-discovered-potential-biosignature-last-year/",
    }]
    for k, c in enumerate(clusters[:MAX_ROWS], start=1):
        rows.append({
            "id": f"steep_slope_{k}", "name": f"Steep slope zone {k} (measured DEM)",
            "lat": round(c["lat"], 4), "lon": round(c["lon"], 4), "radius_m": round(c["radius_m"]),
            "reason": (f"{c['cells']} contiguous 50 m cells steeper than {SLOPE_LIMIT_DEG:.0f} deg in the "
                       f"measured CTX 20 m DTM (max {c['max_slope']:.1f} deg); above the rover slope limit."),
            "source_url": "https://doi.org/10.5066/P906QQT8",
        })
    inp = ROOT / "data" / "inputs" / a.region
    with open(inp / "hazards.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "name", "lat", "lon", "radius_m", "reason", "source_url"])
        w.writeheader()
        for r in rows:
            w.writerow(r)
    n_steep = int(steep.sum())
    print(a.region, f"hazards.csv: {len(rows)} rows "
          f"({n_steep} cells = {100*n_steep/steep.size:.2f}% of grid steeper than {SLOPE_LIMIT_DEG:.0f} deg; "
          f"{len(clusters)} clusters >= {MIN_CELLS} cells, kept {min(len(clusters), MAX_ROWS)})")


if __name__ == "__main__":
    main()
