"""Research Lab tests: upload -> analyse -> get -> bundle, determinism,
no-confident-match for a non-Mars image, and the null-lat routing guard."""
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app import research_lab


@pytest.fixture(autouse=True)
def isolated_lab_db(tmp_path, monkeypatch):
    """Keep test analyses out of the real backend/data/research_lab.db."""
    monkeypatch.setattr(research_lab, "DB_PATH", tmp_path / "test_lab.db")
    monkeypatch.setattr(research_lab, "IMAGES_DIR", tmp_path / "images")
    yield


def _png_bytes(rgb=(150, 100, 60), size=(64, 48), seed=0):
    rng = np.random.default_rng(seed)
    arr = np.clip(rng.normal(0, 12, (size[1], size[0], 3)) + np.array(rgb), 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def _upload(client, data, filename="mars.png"):
    return client.post("/api/analyze-image", files={"image": (filename, data, "image/png")})


def test_analyze_returns_six_sections_in_order(client):
    r = _upload(client, _png_bytes())
    assert r.status_code == 201
    a = r.json()
    keys = list(a.keys())
    order = ["measurements", "matches", "novelty", "hypotheses", "actions", "unknowns"]
    positions = [keys.index(k) for k in order]
    assert positions == sorted(positions), f"six sections out of order: {keys}"
    assert a["width"] == 64 and a["height"] == 48
    assert a["bit_depth"] == 24 and a["channels"] == 3
    assert a["metadata"]["sol"] == "not provided"  # never auto-filled
    assert a["tier"] == 3  # no model server running in this sandbox
    assert a["unknowns"], "Unknowns must never be empty"
    assert any("Absence from the local index is not absence from Mars." in u for u in a["unknowns"])
    assert all("value" in m and "unit" in m and "method" in m for m in a["measurements"])
    assert a["novelty"]["n"] == 6
    assert "small population" in a["novelty"]["plain"]
    assert any(act["action"].startswith("Do nothing") for act in a["actions"])
    assert a["pattern_finder"]["label"].startswith("pattern-finder (local implementation")
    assert "PathCore" not in a["pattern_finder"]["label"]
    assert a["plain_summary"]
    assert len(a["sha256"]) == 64


def test_analyze_deterministic_measurements(client):
    data = _png_bytes(seed=7)
    a1 = _upload(client, data).json()
    a2 = _upload(client, data).json()
    assert a1["measurements"] == a2["measurements"]
    assert a1["feature_vector"] == a2["feature_vector"]
    assert a1["sha256"] == a2["sha256"]


def test_list_get_and_bundle_flow(client):
    a = _upload(client, _png_bytes(seed=3)).json()
    lst = client.get("/api/analyses").json()
    assert lst[0]["id"] == a["id"] and lst[0]["tier"] == 3
    got = client.get(f"/api/analyses/{a['id']}").json()
    assert got["id"] == a["id"] and got["measurements"] == a["measurements"]
    img = client.get(f"/api/analyses/{a['id']}/image")
    assert img.status_code == 200
    z = client.get(f"/api/analyses/{a['id']}/bundle")
    assert z.status_code == 200
    names = zipfile.ZipFile(io.BytesIO(z.content)).namelist()
    assert "analysis.json" in names
    assert "report.md" in names
    assert any(n.startswith("image.") for n in names)
    assert "manifest.json" in names
    bundle = json.loads(zipfile.ZipFile(io.BytesIO(z.content)).read("manifest.json"))
    assert bundle["random_seed"] == 42
    assert bundle["archive"]["file"].endswith("jezero_seed.json")


def test_non_mars_image_has_no_confident_match(client):
    blue = io.BytesIO()
    Image.new("RGB", (64, 48), (0, 0, 255)).save(blue, format="PNG")
    a = _upload(client, blue.getvalue(), "blue.png").json()
    assert a["matches"] == []
    assert a["no_match_note"] == "No confident match in the local archive"
    assert any("Absence from the local index is not absence from Mars." in u for u in a["unknowns"])


def test_analyze_rejects_non_image(client):
    r = client.post("/api/analyze-image", files={"image": ("x.txt", b"not an image", "text/plain")})
    assert r.status_code == 400
    assert client.get("/api/analyses/nope").status_code == 404


def test_route_to_null_lat_site_is_400(client):
    from app import store
    reg = store.get_region("synthetic")
    reg.sites.append({"id": "nullsite", "name": "Bright Angel (test)", "lat": None, "lon": None})
    reg.sites.append({"id": "missinglat", "name": "Cheyava Falls (test)"})
    gl, gc = client.latlon
    body = {"region_id": "synthetic", "start": {"lat": gl(60), "lon": gc(10)}, "goal_site_id": "nullsite"}
    r = client.post("/api/route", json=body)
    assert r.status_code == 400
    assert "no published location" in r.json()["detail"]
    body["goal_site_id"] = "missinglat"
    r = client.post("/api/route", json=body)
    assert r.status_code == 400
    body = {"region_id": "synthetic", "start": {"lat": gl(60), "lon": gc(10)},
            "goal_site_id": "siteB", "via_site_ids": ["nullsite"]}
    r = client.post("/api/route", json=body)
    assert r.status_code == 400


def test_route_landing_to_kodiak_on_real_dem():
    """Landing -> Kodiak on the REAL CTX 20 m DTM region.

    The data agent's region is real when its topographic layer cites the
    USGS CTX DTM (DOI 10.5066/P906QQT8). Skipped while the region is still
    synthetic: routing on synthetic terrain would prove nothing and must
    not be faked.
    """
    repo_root = Path(__file__).resolve().parents[2]
    meta_path = repo_root / "data" / "processed" / "jezero_delta" / "meta.json"
    if not meta_path.exists():
        pytest.skip("jezero_delta processed region does not exist yet (data agent pending)")
    meta = json.loads(meta_path.read_text())
    topo = [l for l in meta.get("layers", []) if l.get("kind") == "topographic"]
    real = any("10.5066/P906QQT8" in str(l.get("source_url", "")) for l in topo)
    if meta.get("synthetic") or not real:
        pytest.skip("jezero_delta DEM is not the measured CTX 20 m DTM yet (no DOI 10.5066/P906QQT8 topographic layer)")
    # Real region present: route landing (18.4446, 77.4509) -> Kodiak (18.4124, 77.3820).
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    r = c.post("/api/route", json={
        "region_id": "jezero_delta",
        "start": {"lat": 18.4446, "lon": 77.4509},
        "goal_site_id": "kodiak",
    })
    assert r.status_code == 200
    body = r.json()
    assert any(route["found"] for route in body["routes"]), body.get("warnings")
    # and the null-lat sites in the same region must still be rejected, not crash the route
    r2 = c.post("/api/route", json={
        "region_id": "jezero_delta",
        "start": {"lat": 18.4446, "lon": 77.4509},
        "goal_site_id": "bright_angel",
    })
    assert r2.status_code == 400
    assert "no published location" in r2.json()["detail"]
