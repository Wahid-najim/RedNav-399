"""Merge science sites + analyst hazards + POV images into sites.json / hazards.json for a region.

Team-edited inputs (CSV, easy for non-coders; keep one row per item and ALWAYS fill source_url):
  data/inputs/<region>/sites.csv    id,name,lat,lon,goal,description,mission,observed,source_url
  data/inputs/<region>/hazards.csv  id,name,lat,lon,radius_m,reason,source_url      (marked from HiRISE/CTX by a human)
  data/inputs/<region>/pov.csv      site_id,file_or_url,rover,camera,sol,earth_date,credit,source_url
POV rule from the NASA brief: only attach an image to a site if the rover photo really was taken THERE (distance_m column optional).
"""
import argparse, csv, json, shutil
from pathlib import Path
import requests
from pipeline import ROOT, PROCESSED


def rows(p: Path):
    return list(csv.DictReader(p.open(encoding="utf-8"))) if p.exists() else []


def _f(v):
    """float or None for an empty cell (sites with no published coordinates)."""
    v = (v or "").strip()
    return float(v) if v else None


def _s(v):
    return (v or "").strip() or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True)
    a = ap.parse_args()
    inp, out = ROOT / "data" / "inputs" / a.region, PROCESSED / a.region
    if not (out / "meta.json").exists():
        raise SystemExit("Build the region first: 02_build_region.py")
    sites = []
    for r in rows(inp / "sites.csv"):
        lat, lon = _f(r.get("lat")), _f(r.get("lon"))
        loc_np = str(r.get("location_not_published") or "").strip().lower() in ("true", "1", "yes")
        if (lat is None or lon is None) and not loc_np:
            raise SystemExit(f"site {r['id']}: empty lat/lon without location_not_published=true — never invent coordinates")
        if not r.get("source_url", "").strip():
            raise SystemExit(f"site {r['id']}: source_url is required")
        rec = {"id": r["id"], "name": r["name"], "lat": lat, "lon": lon, "goal": r["goal"],
               "description": r["description"], "mission": r["mission"], "observed": r["observed"],
               "source_url": r["source_url"], "pov_images": []}
        # Optional enrichment columns (all from published sources; empty = not published).
        # location_not_published sites are NEVER plotted as map markers (frontend handles that);
        # routing to one via goal_site_id is rejected by the API because lat/lon is null.
        rec["location_not_published"] = bool(loc_np)
        for col in ("geology", "science_purpose", "chemistry"):
            rec[col] = _s(r.get(col))
        rec["chem_index"] = _f(r.get("chem_index"))
        sites.append(rec)
    by_id = {s["id"]: s for s in sites}
    (out / "media").mkdir(exist_ok=True)
    for i, r in enumerate(rows(inp / "pov.csv")):
        s = by_id.get(r["site_id"])
        if not s:
            print("WARN pov for unknown site", r["site_id"]); continue
        src = r["file_or_url"]
        fname = f"{r['site_id']}_{i}{Path(src).suffix or '.jpg'}"
        if src.startswith("http"):
            resp = requests.get(src, timeout=300)
            if resp.status_code != 200:
                raise SystemExit(f"POV download failed: {src} -> HTTP {resp.status_code}")
            ctype = resp.headers.get("content-type", "")
            if "image" not in ctype:
                raise SystemExit(f"POV download is not an image: {src} -> {ctype} (refusing to save an error page as a photo)")
            (out / "media" / fname).write_bytes(resp.content)
        else:
            shutil.copy(ROOT / src, out / "media" / fname)
        s["pov_images"].append({"url": f"/api/regions/{a.region}/media/{fname}", "rover": r["rover"], "camera": r["camera"],
                                "sol": r["sol"], "earth_date": r["earth_date"], "credit": r["credit"], "source_url": r["source_url"]})
    hazards = [{"id": r["id"], "name": r["name"], "lat": float(r["lat"]), "lon": float(r["lon"]), "radius_m": float(r["radius_m"]),
                "reason": r["reason"], "source_url": r["source_url"]} for r in rows(inp / "hazards.csv")]
    (out / "sites.json").write_text(json.dumps(sites, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "hazards.json").write_text(json.dumps(hazards, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{a.region}: {len(sites)} sites, {len(hazards)} hazards, {sum(len(s['pov_images']) for s in sites)} POV images")


if __name__ == "__main__":
    main()
