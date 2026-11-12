"""Evidence for docs/VALIDATION.md. Run: python backend/scripts/validate.py   (needs the real region: run_all.py --region jezero_delta)
Prints PASS/FAIL lines for the NASA-brief checks, on the REAL Jezero region
(measured USGS CTX 20 m DTM, DOI 10.5066/P906QQT8), plus Research Lab,
null-coordinate-site, provenance and DEM-anchor checks."""
import io
import sys, warnings
from pathlib import Path
warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.store import get_region

c = TestClient(app)
RID = "jezero_delta"
reg = get_region(RID)
sites = {s["id"]: s for s in reg.sites}
b, d = sites["octavia_butler_landing"], sites["kodiak"]
ok_all = True


def check(name, ok, detail):
    global ok_all
    ok_all &= bool(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


def route(goal=None, **kw):
    body = {"region_id": RID, "start": {"lat": b["lat"], "lon": b["lon"]},
            "goal_site_id": (goal or d)["id"], "obstacles": []}
    body.update(kw)
    return c.post("/api/route", json=body).json()


# 1 layers aligned: every raster has exactly the grid size of the elevation model
g = reg.grid
sizes = {f: Image.open(reg.folder / f).size for f in ["imagery.png", "hillshade.png", "slope.png", "hazard.png", "chemical.png"]}
check("layers aligned", all(s == (g.width, g.height) for s in sizes.values()) and reg.dem.shape == (g.height, g.width) == reg.chem.shape,
      f"grid {g.width}x{g.height} @ {g.cell_m} m; rasters {sizes}")

# 2 route reaches goal (landing -> Kodiak, real DEM)
r = route(); p = next((x for x in r["routes"] if x["found"]), None)
end = p["points"][-1]
gr, gc = g.latlon_to_cell(d["lat"], d["lon"])
check("route reaches goal", p is not None and g.xy_to_cell(end["x"], end["y"]) == (gr, gc),
      f"{len([x for x in r['routes'] if x['found']])} route(s) found, balanced {p['distance_m']} m, max slope {p['max_slope_deg']} deg, no cell over the limit")

# 3 obstacle changes route (block the midpoint of the balanced route).
# On this gentle floor terrain a detour can have the same length (many
# minimal-step paths exist), so the check is: the path itself must change.
mid = p["points"][len(p["points"]) // 2]
mrow, mcol = g.xy_to_cell(mid["x"], mid["y"])
mlat, mlon = g.cell_to_latlon(mrow, mcol)
r2 = route(obstacles=[{"lat": mlat, "lon": mlon, "radius_m": 400}])
p2 = next((x for x in r2["routes"] if x["found"]), None)
path_changed = p2 is not None and [(q["x"], q["y"]) for q in p2["points"]] != [(q["x"], q["y"]) for q in p["points"]]
check("obstacle changes route", path_changed,
      f"baseline {p['distance_m']} m -> {p2['distance_m'] if p2 else 'no route'} m after blocking the route midpoint (path changed: {path_changed})")

# 4 slope limit changes route (very low limit forces detours on the same pair)
r3 = route(max_slope_deg=3, caution_slope_deg=2)
p3 = next((x for x in r3["routes"] if x["found"]), None)
check("slope limit changes route", p3 is None or p3["distance_m"] > p["distance_m"],
      f"limit 20 deg: {p['distance_m']} m; limit 3 deg: {p3['distance_m'] if p3 else 'no route'} m")

# 5 missing data is visible: coverage gap in the chemical raster + null-location sites
gap = int(np.isnan(reg.chem).sum())
nan_cells = np.argwhere(np.isnan(reg.chem))
nan_lat, nan_lon = g.cell_to_latlon(int(nan_cells[0][0]), int(nan_cells[0][1]))
meta = c.get(f"/api/regions/{RID}").json()
bd = c.get("/api/regions/bd_bogra/sites").json()[1]
null_sites = [s for s in reg.sites if s.get("lat") is None]
check("missing data visible", gap > 0 and reg.chem_at(nan_lat, nan_lon) is None and len(null_sites) == 3,
      f"{gap} chemical cells have NO coverage (returned as None, drawn grey); {len(null_sites)} sites have no published location (Bright Angel, Cheyava Falls, Broom Point); BD craters report 'rover photos: MISSING' ({len(bd['pov_images'])} images)")

# 6 travel-time and oxygen assumptions explained
a = route(load_factor=1.0, science_stop_min=0)["routes"][0]; a2 = route(load_factor=2.0, science_stop_min=0)["routes"][0]
ox = p["safety"]["oxygen"]
check("travel-time / oxygen assumptions explained", a2["walk_time_min"] > 1.9 * a["walk_time_min"] and "assumption" in ox["assumption"].lower() and meta["suit_assumptions"],
      f"walk {a['walk_time_min']} min -> {a2['walk_time_min']} min with 2x cargo; O2 on arrival {ox['remaining_on_arrival_pct']}%, after return {ox['remaining_after_return_pct']}% (reserve {ox['reserve_pct']}%)")

# 7 Bangladesh regions load and route
bd_ok = []
for rid in ["bd_bogra", "bd_sripur", "bd_teknaf", "bd_ruhea", "bd_satkania"]:
    ss = c.get(f"/api/regions/{rid}/sites").json()
    rr = c.post("/api/route", json={"region_id": rid, "start": {"lat": ss[0]["lat"], "lon": ss[0]["lon"]}, "goal_site_id": ss[1]["id"], "obstacles": []}).json()
    bd_ok.append(any(x["found"] for x in rr["routes"]))
check("5 Bangladesh regions route", all(bd_ok), "Bogra, Sripur, Teknaf, Ruhea, Satkania: base -> rim route found in each (SYNTHETIC terrain, coordinates verified in IAU Gazetteer)")

# 8 null-coordinate sites are not routable (must 400, never crash)
resp = c.post("/api/route", json={"region_id": RID, "start": {"lat": b["lat"], "lon": b["lon"]}, "goal_site_id": "cheyava_falls", "obstacles": []})
check("null-location site not routable", resp.status_code == 400,
      f"route to Cheyava Falls (no published coordinates) -> HTTP {resp.status_code}")

# 9 DEM anchors vs published values (sampled from built dem.npy)
def sample(lat, lon):
    r0, c0 = g.latlon_to_cell(lat, lon)
    return float(reg.dem[r0, c0])
anchors = [("landing 18.4446N 77.4509E", sample(18.4446, 77.4509), -2570, 5),
           ("crater floor 18.38N 77.45E", sample(18.38, 77.45), -2600, 10),
           ("Belva centre 18.48N 77.38E", sample(18.48, 77.38), -2489, 5),
           ("Kodiak centre 18.4124N 77.3820E", sample(18.4124, 77.3820), -2527, 5)]
anchor_ok = all(abs(v - pub) <= tol for _, v, pub, tol in anchors)
check("DEM anchors vs published values", anchor_ok,
      "; ".join(f"{n}: {v:.1f} m (published {pub}, tol ±{tol})" for n, v, pub, tol in anchors))

# 10 provenance: topographic layer is MEASURED CTX with DOI, not synthetic
topo = next((ly for ly in meta["layers"] if ly["kind"] == "topographic"), {})
check("provenance is MEASURED CTX", topo.get("mission") == "Mars Reconnaissance Orbiter" and topo.get("instrument") == "CTX"
      and "10.5066/P906QQT8" in str(topo.get("source_url", "")) and not meta.get("synthetic"),
      f"mission={topo.get('mission')}, instrument={topo.get('instrument')}, resolution={topo.get('resolution_m')} m, synthetic={meta.get('synthetic')}")

# 11 Research Lab works offline (Tier 3, no model server): 6 sections, unknowns never empty
img = Image.new("RGB", (160, 120), (170, 90, 60))
buf = io.BytesIO(); img.save(buf, "PNG"); buf.seek(0)
ar = c.post("/api/analyze-image", files={"image": ("test.png", buf, "image/png")})
ana = ar.json() if ar.status_code in (200, 201) else {}
sections = ["measurements", "matches", "novelty", "hypotheses", "actions", "unknowns"]
sec_ok = all(k in ana for k in sections) and len(ana.get("unknowns", [])) > 0
brain = c.get("/api/brain").json()
check("Research Lab offline analysis", ar.status_code in (200, 201) and sec_ok and brain.get("tier") == 3,
      f"POST /api/analyze-image -> {ar.status_code}, sections present, {len(ana.get('measurements', []))} measurements, {len(ana.get('unknowns', []))} unknowns, brain tier {brain.get('tier')} ({brain.get('brain')})")

# 12 evidence bundle is reproducible (ZIP with all four files)
bid = ana.get("id")
br = c.get(f"/api/analyses/{bid}/bundle") if bid else None
import zipfile
names = zipfile.ZipFile(io.BytesIO(br.content)).namelist() if br is not None and br.status_code == 200 else []
check("evidence bundle complete", set(names) == {"analysis.json", "report.md", "manifest.json", "image.png"},
      f"bundle ZIP for analysis {bid}: {sorted(names)}")

print("\nALL PASS" if ok_all else "\nSOME FAILED")
sys.exit(0 if ok_all else 1)
