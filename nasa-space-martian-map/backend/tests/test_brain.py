"""Brain / tier tests. No model server runs in this sandbox, so Tier 3
(Minimal, ONNX/classical-CV only) is the expected effective tier."""
import io

import numpy as np
import pytest
from PIL import Image

from app import brain


def _png_bytes(rgb=(150, 100, 60), size=(64, 48), seed=0):
    rng = np.random.default_rng(seed)
    arr = np.clip(rng.normal(0, 12, (*size[::-1], 3)) + np.array(rgb), 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def test_brain_status_reports_tier3_minimal(client):
    r = client.get("/api/brain")
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == 3
    assert body["tier_name"] == "Minimal"
    assert body["model"] is None
    assert body["available"] is True  # Tier 3 (classical-CV) is always available
    assert body["ram_mb"] is None or body["ram_mb"] > 0
    assert body["odysseus_reachable"] is False
    assert body["ollama_reachable"] is False


def test_brain_tier_set_autodrops_without_server(client):
    r = client.post("/api/brain/tier", json={"tier": 2})
    assert r.status_code == 200
    body = r.json()
    assert body["requested_tier_set"] == 2
    assert body["tier"] == 3  # no localhost model server -> auto-drop to Minimal
    assert body["notes"]  # the drop is explained, never silent
    client.post("/api/brain/tier", json={"tier": 3})


def test_brain_tier_rejects_invalid(client):
    assert client.post("/api/brain/tier", json={"tier": 5}).status_code == 400
    assert client.post("/api/brain/tier", json={"tier": 0}).status_code == 400


def test_cv_pipeline_deterministic():
    img = Image.open(io.BytesIO(_png_bytes()))
    a = brain.measure_image(img)
    b = brain.measure_image(img)
    assert a["measurements"] == b["measurements"]
    assert a["feature_vector"] == b["feature_vector"]
    assert len(a["feature_vector"]) == 6
    frac = a["fractions"]
    assert abs(frac["dark"] + frac["mid"] + frac["bright"] - 1.0) < 1e-6
    assert all("value" in m and "unit" in m and "method" in m for m in a["measurements"])


def test_cv_pipeline_blue_image_is_dark_and_untextured():
    img = Image.new("RGB", (32, 32), (0, 0, 255))
    m = brain.measure_image(img)
    by_name = {row["name"]: row["value"] for row in m["measurements"]}
    assert by_name["mean blue"] == 255.0
    assert by_name["mean red"] == 0.0
    assert by_name["edge density"] == 0.0


def test_ram_reading_is_stdlib_only():
    ram = brain.read_ram_mb()
    assert "available_mb" in ram and "total_mb" in ram
    # In this Linux VM both must be real numbers, not None.
    assert ram["available_mb"] and ram["available_mb"] > 0
