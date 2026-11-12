"""Build geology.json (Z1-Z6 zone polygons, lat/lon) for jezero_delta.

  python 07_build_geology.py --region jezero_delta

Polygons live in jezero_zones.py (shared with 06_build_chemistry.py).
Every polygon is labelled "approximate, from published zone descriptions" —
boundaries are drawn from published anchors, not surveyed.
"""
import argparse, json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import PROCESSED
from jezero_zones import ZONE_POLYGONS, ZONE_INFO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="jezero_delta")
    a = ap.parse_args()
    out = PROCESSED / a.region
    geology = []
    for zid in ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6"]:
        info = ZONE_INFO[zid]
        poly = ZONE_POLYGONS.get(zid)
        if poly is None:
            # Z1 is the crater floor default: the whole region box minus the other zones.
            # Represent it as the box outline; the UI draws it under the other polygons.
            meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
            g = meta["grid"]
            import math
            from jezero_zones import MARS_R
            south = g["north_lat"] - g["height"] * g["cell_m"] / (MARS_R * math.pi / 180.0)
            east = g["west_lon"] + g["width"] * g["cell_m"] / (MARS_R * math.cos(math.radians(g["north_lat"])) * math.pi / 180.0)
            poly = [[g["north_lat"], g["west_lon"]], [g["north_lat"], east], [south, east], [south, g["west_lon"]]]
        geology.append({
            "id": zid.lower(), "name": info["name"], "type": "zone",
            "polygon": [[lat, lon] for lat, lon in poly],
            "description": info["description"] + " Boundaries approximate, from published zone descriptions.",
            "chemistry": info["chemistry"],
            "source": info["source"],
            "approximate": True,
        })
    (out / "geology.json").write_text(json.dumps(geology, indent=2, ensure_ascii=False), encoding="utf-8")
    print(a.region, "geology.json:", len(geology), "zones (all approximate)")


if __name__ == "__main__":
    main()
