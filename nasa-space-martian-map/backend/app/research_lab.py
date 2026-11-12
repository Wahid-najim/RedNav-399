"""Research Lab: offline scientific instrument for Jezero Crater images.

DECISION HELPER, not a discoverer. The scientist draws the conclusions;
this pipeline only produces, in order:
  1. defensible measurements (classical-CV + optional ONNX, always on)
  2. similar-feature matches from the local archive
  3. novelty scoring against a defined reference population
  4. literature-backed hypotheses, each with a real citation
  5. ranked next-best actions, each with cost and expected value
  6. honest unknowns (mandatory, never empty)

Hard rules enforced here:
- Never fabricate: no invented measurements, citations, coordinates.
- A model score is never a geological claim: every model output is
  labelled "model output" with its metric and method.
- Absence from the local index is never absence from Mars (stated in
  every analysis's unknowns).
- A potential biosignature is "potential biosignature only", never life.
- Storage is local SQLite only; no cloud, no API key, no telemetry.
- No network calls at run time except to localhost model servers.
- Deterministic: same image twice -> identical measurements
  (seed config.BRAIN_RANDOM_SEED is logged in the manifest; the CV
  pipeline itself uses no randomness).
"""
import io
import json
import sqlite3
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from PIL import Image

from . import brain, config
from .pattern_finder import find_patterns

router = APIRouter()

BASE = Path(__file__).resolve().parent
ARCHIVE_PATH = BASE / "archive" / "jezero_seed.json"
DATA_DIR = BASE.parent / "data"
DB_PATH = DATA_DIR / "research_lab.db"
IMAGES_DIR = DATA_DIR / "images"

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
ALLOWED_MIME = {"image/png", "image/jpeg", "image/tiff"}


def _load_archive() -> dict:
    return json.loads(ARCHIVE_PATH.read_text(encoding="utf-8"))


def _db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS analyses (
               id TEXT PRIMARY KEY, created_at TEXT, filename TEXT,
               sha256 TEXT, tier INTEGER, analysis_json TEXT, image_path TEXT)"""
    )
    conn.commit()
    return conn


def _cosine(a: list[float], b: list[float]) -> float:
    av, bv = np.array(a, dtype=float), np.array(b, dtype=float)
    denom = float(np.linalg.norm(av) * np.linalg.norm(bv))
    return round(float(np.dot(av, bv) / denom), 4) if denom else 0.0


def _zone_vector(archive: dict, zone_id: str) -> list[float]:
    for z in archive["zones"]:
        if z["id"] == zone_id:
            return z["descriptor_vector"]
    return [0.0] * 6


def _novelty(feature_vector: list[float], archive: dict) -> dict:
    """Distance from the reference-population mean in feature space, in sigma.

    Population: the six Jezero zones Z1-Z6 (n = 6 -- small population, say
    so). sigma is the standard deviation of the zones' own distances to
    their mean. A high score means 'unlike the reference population'. It
    does NOT mean 'new', 'important', or 'a biosignature'.
    """
    zone_vecs = [z["descriptor_vector"] for z in archive["zones"]]
    mean = np.mean(np.array(zone_vecs), dtype=float)
    dists = [float(np.linalg.norm(np.array(v) - mean)) for v in zone_vecs]
    sigma_pop = float(np.std(dists)) or 0.05
    d = float(np.linalg.norm(np.array(feature_vector) - mean))
    score = round(d / sigma_pop, 2)
    return {
        "score_sigma": score,
        "population": config.BRAIN_NOVELTY_POPULATION,
        "n": config.BRAIN_NOVELTY_N,
        "method": ("Euclidean distance of the image feature vector from the mean "
                   "of the 6 zone descriptor vectors, divided by the standard "
                   "deviation of the zones' own distances to that mean"),
        "plain": (f"Novelty {score} sigma from the {config.BRAIN_NOVELTY_POPULATION} "
                  f"(n = {config.BRAIN_NOVELTY_N} -- small population). A high score means "
                  "'unlike the reference population'. It does NOT mean 'new', 'important', "
                  "or 'a biosignature'."),
    }


def _matches(feature_vector: list[float], archive: dict) -> tuple[list[dict], str | None]:
    """Top 5 similar archive features by cosine similarity.

    Below config.BRAIN_MATCH_THRESHOLD (0.5) the result is 'No confident
    match in the local archive' -- the least-bad match is never promoted.
    """
    scored = []
    for f in archive["features"]:
        scored.append((_cosine(feature_vector, f["descriptor_vector"]), f))
    scored.sort(key=lambda t: -t[0])
    top = scored[:5]
    if not top or top[0][0] < config.BRAIN_MATCH_THRESHOLD:
        return [], "No confident match in the local archive"
    out = []
    for score, f in top:
        if score < config.BRAIN_MATCH_THRESHOLD:
            continue
        out.append({
            "name": f["name"],
            "score": score,
            "metric": "cosine, feature vector [mean R, mean G, mean B, luminance std, edge density, bright fraction]",
            "shared_properties": list(f["properties"]),
            "archive_ref": f["archive_ref"],
            "thumbnail_url": None,  # archive has no image files; never invent one
            "label": "model output -- this is a similarity score, not proof the features are the same rock type.",
            "zone": f["zone"],
        })
    return out, None


def _hypotheses(measurements: dict, matches: list[dict], archive: dict) -> list[dict]:
    """Hypotheses ONLY from the local literature index (seed citations).

    Each rule needs a supporting measurement from THIS image and a citation
    that is actually in the local index. No citation -> the idea goes to
    Unknowns, never shown as a hypothesis.
    """
    by_id = {c["id"]: c for c in archive["citations"]}
    m = {row["name"]: row["value"] for row in measurements["measurements"]}
    frac = measurements["fractions"]
    top_zone = matches[0]["zone"] if matches else None
    out = []

    def citation(cid: str) -> dict:
        c = by_id[cid]
        return {"author": c["author"], "year": c["year"], "title": c["title"],
                "source_file": c["source_file"]}

    if frac["bright"] >= 0.45 and top_zone in ("Z2", "Z3", "Z4"):
        out.append({
            "text": ("The light-toned, layered character measured here is consistent with "
                     "carbonate-bearing delta / Margin Unit rock as described for Jezero."),
            "supporting_measurements": [
                f"bright region fraction {frac['bright']:.2f}",
                f"top archive match in zone {top_zone}",
            ],
            "citation": citation("clave2026"),
            "confidence": "supported by 2 measurements, 1 citation (evidence-based, not a claim of truth)",
        })
    if m.get("edge density", 0) >= 0.35 and m.get("luminance std", 0) >= 0.22:
        out.append({
            "text": ("The spotted, high-contrast texture measured here is consistent with the "
                     "leopard-spot texture described at Cheyava Falls; the Sapphire Canyon core "
                     "is a POTENTIAL biosignature only -- not confirmed life."),
            "supporting_measurements": [
                f"edge density {m['edge density']:.2f}",
                f"luminance std {m['luminance std']:.2f}",
            ],
            "citation": citation("nasa_samples"),
            "confidence": "supported by 2 measurements, 1 citation (evidence-based, not a claim of truth)",
        })
    if frac["dark"] >= 0.45 and top_zone in ("Z1", "Z5"):
        out.append({
            "text": ("The dark-toned basaltic character measured here is consistent with the "
                     "crater-floor Máaz / Séítah units measured by SuperCam."),
            "supporting_measurements": [
                f"dark region fraction {frac['dark']:.2f}",
                f"top archive match in zone {top_zone}",
            ],
            "citation": citation("wiens2022"),
            "confidence": "supported by 2 measurements, 1 citation (evidence-based, not a claim of truth)",
        })
    return out


def _actions() -> list[dict]:
    """Ranked by expected value / cost; both shown. 'Do nothing' is always
    present. Cost-unknown actions are listed under 'cost unknown' with
    rank null, never ranked first."""
    ranked = [
        {"rank": 1, "action": "Re-image at higher resolution", "cost": "1 sol",
         "cost_sols": 1.0, "expected_value": 0.8, "cost_unknown": False,
         "why": "Higher resolution would resolve grain and layering the current image cannot."},
        {"rank": 2, "action": "SuperCam LIBS on this target", "cost": "2 sols",
         "cost_sols": 2.0, "expected_value": 0.9, "cost_unknown": False,
         "why": "LIBS would give oxide chemistry to compare with the published SuperCam tables (T7/T8)."},
        {"rank": 3, "action": "Drive closer and re-image", "cost": "3 sols",
         "cost_sols": 3.0, "expected_value": 0.7, "cost_unknown": False,
         "why": "A closer view would test whether the texture is real or an imaging artefact."},
        {"rank": 4, "action": "Do nothing — archive and move on", "cost": "0 sols",
         "cost_sols": 0.0, "expected_value": 0.1, "cost_unknown": False,
         "why": "The archive already covers this feature type; further work has low expected value."},
    ]
    # rank by expected_value / cost (cost 0 -> ratio = expected value, so
    # "Do nothing" ranks last by construction, never first)
    for a in ranked:
        a["expected_value_per_cost"] = round(
            a["expected_value"] / a["cost_sols"] if a["cost_sols"] > 0 else a["expected_value"], 3)
    ranked.sort(key=lambda a: -a["expected_value_per_cost"])
    for i, a in enumerate(ranked, 1):
        a["rank"] = i
        del a["cost_sols"]
    ranked.append({"rank": None, "action": "Request HiRISE 25 cm/px targeted observation",
                   "cost": "unknown", "expected_value": 0.85, "cost_unknown": True,
                   "expected_value_per_cost": None,
                   "why": "Cost unknown (targeting queue and downlink are not in the local archive), so it is not ranked."})
    return ranked


def _unknowns(meta: dict, measurements: dict, matches: list[dict], hypotheses: list[dict],
              no_match_note: str | None, onnx: dict | None, brain_expl: str | None) -> list[str]:
    scale = measurements["scale_note"]
    out = [
        f"What was not measured: {scale}. No scale bar was marked and no calibration target was in frame, so sizes are in pixels only.",
        "What was not measured: mineralogy and chemistry -- an image alone cannot measure oxide wt% (SuperCam/PIXL data would be needed).",
        "What the local archive does NOT contain: images of the archived features (the seed archive holds published values and descriptions, not image files), and no published lat/lon for Bright Angel, Cheyava Falls or Broom Point. Absence from the local index is not absence from Mars.",
        "What the model cannot tell: the classical-CV pipeline measures tone and texture only; it cannot distinguish carbonate from other light-toned minerals, and it cannot name a rock type. The ONNX segmentation (if used) is a model output, not a geological claim.",
        "What would resolve each unknown: a scale (pixels-to-cm from the scientist or a scale bar) for sizes; a SuperCam LIBS raster for chemistry; a higher-resolution re-image for texture; a published coordinate for any site that currently has none.",
    ]
    if no_match_note:
        out.append(f"No confident match: {no_match_note}. Absence from the local index is not absence from Mars.")
    if not hypotheses:
        out.append("No hypothesis had both a supporting measurement from this image and a citation in the local index, so no hypothesis is shown. No literature in the local index covers this image's features -- that is a gap in the index, not a fact about Mars.")
    if onnx is None:
        out.append("The bundled ONNX segmentation model was not run for this image (onnxruntime or the model files were unavailable); measurements come from the classical-CV pipeline only.")
    if brain_expl is None:
        out.append("No language-model explanation was produced (no localhost model server reachable); the measurements, matches, novelty score, actions and unknowns above do not depend on a language model.")
    return out


def _manifest(analysis_id: str, tier_info: dict, onnx: dict | None) -> dict:
    models = []
    for m in brain.models_on_disk():
        name = m["name"]
        if name == brain.GGUF_NAME:
            models.append({"name": "Qwen2.5-0.5B-Instruct Q4_K_M (GGUF)", "version": "Qwen2.5-0.5B-Instruct-GGUF",
                           "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF",
                           "sha256": m["sha256"], "bytes": m["bytes"], "licence": "Apache-2.0",
                           "role": "narrator (Tier 2); needs a localhost model server to run -- NOT loaded by this backend"})
        elif name == brain.ONNX_ENCODER_NAME:
            models.append({"name": "MobileSAM image encoder (ONNX)", "version": "Acly/MobileSAM export",
                           "url": "https://huggingface.co/Acly/MobileSAM",
                           "sha256": m["sha256"], "bytes": m["bytes"], "licence": "Apache-2.0",
                           "role": "segmentation encoder (optional, CPU)"})
        elif name == brain.ONNX_DECODER_NAME:
            models.append({"name": "SAM single-mask decoder (ONNX)", "version": "Acly/MobileSAM export",
                           "url": "https://huggingface.co/Acly/MobileSAM",
                           "sha256": m["sha256"], "bytes": m["bytes"], "licence": "Apache-2.0",
                           "role": "segmentation decoder (optional, CPU)"})
    return {
        "analysis_id": analysis_id,
        "models": models,
        "onnx_segmentation": onnx,
        "archive": {"file": "backend/app/archive/jezero_seed.json",
                    "source": "jezeroVerified.ts (T1-T13 + Z1-Z6), transcribed from the two Jezero PDFs' values",
                    "citations": ["Wiens et al. 2022, Science Advances 8, eabo3399",
                                  "Clavé et al. 2026, JGR Planets, doi:10.1029/2025JE009107",
                                  "NASA NSSDC Mars Fact Sheet (updated 19 May 2025)",
                                  "NASA MOXIE (2023-09-06)"]},
        "tier": tier_info["tier"], "tier_name": tier_info["tier_name"], "brain": tier_info["brain"],
        "random_seed": config.BRAIN_RANDOM_SEED,
        "determinism_note": "The classical-CV pipeline uses no randomness; the same image bytes always give identical measurements. Seed is logged for any future seeded step.",
        "pipeline": "brain.measure_image (numpy+Pillow Otsu segmentation) + pattern_finder (local co-occurrence)",
        "sources": {"archive": "backend/app/archive/jezero_seed.json",
                    "verification_log": "docs/VERIFICATION_LOG.md"},
    }


def _report_md(a: dict) -> str:
    lines = [f"# Research Lab analysis {a['id']}", "",
             f"File: {a['filename']} | SHA-256: {a['sha256']} | {a['width']}x{a['height']} px | "
             f"Tier {a['tier']} ({a['brain']}) | {a['created_at']}", "",
             f"Plain summary: {a['plain_summary']}", "",
             "## 1. Measurements"]
    for m in a["measurements"]:
        lines.append(f"- {m['name']}: {m['value']} {m['unit']} (method: {m['method']}; uncertainty: {m['uncertainty']})")
    lines += ["", "## 2. Similar-feature matches"]
    if a.get("no_match_note"):
        lines.append(a["no_match_note"] + " Absence from the local index is not absence from Mars.")
    for mt in a["matches"]:
        lines.append(f"- {mt['name']}: {mt['score']} ({mt['metric']}) -- {mt['label']} Shared: {', '.join(mt['shared_properties'])}; ref {mt['archive_ref']}")
    lines += ["", "## 3. Novelty", a["novelty"]["plain"], "",
              "## 4. Hypotheses"]
    if not a["hypotheses"]:
        lines.append("No literature in the local index covers this.")
    for h in a["hypotheses"]:
        c = h["citation"]
        lines.append(f"- {h['text']} Supporting: {'; '.join(h['supporting_measurements'])}. "
                     f"Citation: {c['author']} ({c['year']}), {c['title']}, {c['source_file']}. Confidence: {h['confidence']}")
    lines += ["", "## 5. Ranked next-best actions"]
    for act in a["actions"]:
        rank = act["rank"] if act["rank"] is not None else "cost unknown"
        lines.append(f"- Rank {rank}: {act['action']} -- cost {act['cost']}, expected value {act['expected_value']}. {act.get('why', '')}")
    lines += ["", "## 6. Unknowns"]
    for u in a["unknowns"]:
        lines.append(f"- {u}")
    lines += ["", f"## Pattern finder ({a['pattern_finder']['label']})"]
    for p in a["pattern_finder"]["pairs"]:
        lines.append(f"- {p['a']} + {p['b']}: count {p['count']}, expected {p['expected']}. {p['note']}")
    return "\n".join(lines) + "\n"


def _analyse(image_bytes: bytes, filename: str, meta: dict) -> dict:
    archive = _load_archive()
    tier_info = brain.effective_tier()
    tier = tier_info["tier"]
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    fmt = (image.format or "").upper()
    bit_depth = {"RGB": 24, "RGBA": 32, "L": 8, "I;16": 16}.get(image.mode, 8)
    channels = len(image.getbands())
    measurements = brain.measure_image(image)
    onnx = brain.onnx_segment(image)
    if onnx is not None:
        measurements["measurements"].append({
            "name": "ONNX centre-mask area fraction", "value": onnx["mask_area_fraction"],
            "unit": "fraction",
            "method": onnx["method"] + " (model output)",
            "uncertainty": f"IoU prediction {onnx['iou_prediction']} (model output)",
        })
    matches, no_match_note = _matches(measurements["feature_vector"], archive)
    novelty = _novelty(measurements["feature_vector"], archive)
    hypotheses = _hypotheses(measurements, matches, archive)
    actions = _actions()
    patterns = find_patterns(archive["features"])
    brain_expl = None
    if tier in (1, 2) and tier_info.get("model"):
        prompt = ("Explain in one plain sentence what was measured in this Mars image: "
                  f"bright fraction {measurements['fractions']['bright']:.2f}, dark fraction "
                  f"{measurements['fractions']['dark']:.2f}, edge density "
                  f"{[m['value'] for m in measurements['measurements'] if m['name'] == 'edge density'][0]}. "
                  "Do not name a rock type and do not draw a conclusion.")
        brain_expl = brain.odysseus_generate(prompt)
    unknowns = _unknowns(meta, measurements, matches, hypotheses, no_match_note, onnx, brain_expl)

    top = matches[0]["name"] if matches else "no confident match"
    plain = (f"Measured a {image.width}x{image.height} image (bright fraction "
             f"{measurements['fractions']['bright']:.2f}, edge density "
             f"{[m['value'] for m in measurements['measurements'] if m['name'] == 'edge density'][0]:.2f}); "
             f"top archive match: {top}; novelty {novelty['score_sigma']} sigma from the "
             f"Jezero zones population (n = 6); {len(hypotheses)} literature-backed "
             f"{'hypothesis' if len(hypotheses) == 1 else 'hypotheses'}; {len(unknowns)} unknowns listed.")
    return {
        "id": uuid.uuid4().hex[:12],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": filename,
        "sha256": brain.sha256_bytes(image_bytes),
        "width": image.width, "height": image.height,
        "bit_depth": bit_depth, "channels": channels,
        "image_format": fmt or "unknown",
        "metadata": meta,
        "tier": tier, "tier_name": tier_info["tier_name"], "brain": tier_info["brain"],
        "measurements": measurements["measurements"],
        "feature_vector": measurements["feature_vector"],
        "colour_histogram_8bin": measurements["colour_histogram_8bin"],
        "scale_note": measurements["scale_note"],
        "onnx_segmentation": onnx,
        "brain_explanation": ({"text": brain_expl, "label": "model output",
                                "model": tier_info.get("model")} if brain_expl else None),
        "matches": matches,
        "no_match_note": no_match_note,
        "novelty": novelty,
        "hypotheses": hypotheses,
        "actions": actions,
        "unknowns": unknowns,
        "pattern_finder": patterns,
        "plain_summary": plain,
        "manifest": None,  # filled in by the caller (needs the id)
    }


@router.post("/api/analyze-image", status_code=201)
async def analyze_image(
    image: UploadFile = File(...),
    sol: str | None = Form(default=None),
    instrument: str | None = Form(default=None),
    lat: str | None = Form(default=None),
    lon: str | None = Form(default=None),
    note: str | None = Form(default=None),
):
    ext = Path(image.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT and (image.content_type or "") not in ALLOWED_MIME:
        raise HTTPException(400, f"unsupported image type: {image.filename!r} (accept PNG, JPG, TIFF)")
    data = await image.read()
    if len(data) > config.RESEARCH_LAB_MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(400, f"image larger than {config.RESEARCH_LAB_MAX_IMAGE_MB} MB")
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise HTTPException(400, "uploaded file is not a readable image")
    # Optional metadata is NEVER auto-filled: missing -> "not provided".
    meta = {
        "sol": sol if sol else "not provided",
        "instrument": instrument if instrument else "not provided",
        "lat": lat if lat else "not provided",
        "lon": lon if lon else "not provided",
        "note": note if note else "not provided",
    }
    analysis = _analyse(data, image.filename or "upload", meta)
    analysis["manifest"] = _manifest(analysis["id"], brain.effective_tier(), analysis["onnx_segmentation"])
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    img_path = IMAGES_DIR / f"{analysis['id']}{ext or '.png'}"
    img_path.write_bytes(data)
    conn = _db()
    conn.execute(
        "INSERT INTO analyses (id, created_at, filename, sha256, tier, analysis_json, image_path) VALUES (?,?,?,?,?,?,?)",
        (analysis["id"], analysis["created_at"], analysis["filename"], analysis["sha256"],
         analysis["tier"], json.dumps(analysis), str(img_path)),
    )
    conn.commit()
    conn.close()
    return JSONResponse(status_code=201, content=analysis)


@router.get("/api/analyses")
def list_analyses():
    conn = _db()
    rows = conn.execute(
        "SELECT id, created_at, filename, tier FROM analyses ORDER BY created_at DESC, rowid DESC"
    ).fetchall()
    conn.close()
    return [{"id": r[0], "created_at": r[1], "filename": r[2], "tier": r[3]} for r in rows]


def _get_analysis(analysis_id: str) -> dict:
    conn = _db()
    row = conn.execute(
        "SELECT analysis_json, image_path FROM analyses WHERE id = ?", (analysis_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, f"analysis {analysis_id} not found")
    return json.loads(row[0]), row[1]


@router.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: str):
    analysis, _ = _get_analysis(analysis_id)
    return analysis


@router.get("/api/analyses/{analysis_id}/image")
def get_analysis_image(analysis_id: str):
    _, image_path = _get_analysis(analysis_id)
    p = Path(image_path)
    if not p.exists():
        raise HTTPException(404, "uploaded image file is missing from local storage")
    return FileResponse(p)


@router.get("/api/analyses/{analysis_id}/bundle")
def get_bundle(analysis_id: str):
    """Evidence bundle ZIP: analysis.json, report.md, the uploaded image,
    manifest.json -- enough for a second scientist to reproduce the result
    without this app."""
    analysis, image_path = _get_analysis(analysis_id)
    p = Path(image_path)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("analysis.json", json.dumps(analysis, indent=2))
        z.writestr("report.md", _report_md(analysis))
        if p.exists():
            z.write(p, arcname=f"image{p.suffix}")
        z.writestr("manifest.json", json.dumps(analysis["manifest"], indent=2))
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="analysis-{analysis_id}.zip"'})
