"""Local brain: tier manager, Odysseus localhost client, and the always-on
classical-CV + ONNX measurement pipeline.

Design (master spec Section 2b, low-RAM budget: i3-1215U, 8 GB RAM, no GPU):
- The tiny ONNX + classical-CV pipeline does ALL measuring and is ALWAYS ON.
  It is deterministic (seeded, see config.BRAIN_RANDOM_SEED) and needs no
  language model. A small language model only writes plain-language
  explanations; if it is unavailable, the numbers still show.
- Three tiers: 1 FULL (Odysseus local models over localhost), 2 LIGHT
  (0.5B narrator + ONNX/classical-CV), 3 MINIMAL (ONNX/classical-CV only).
  The app AUTO-DROPS a tier when RAM is over budget or the local model
  server is unreachable. Dropping a tier is never an error.
- ONE model loaded at a time, ever. This module never loads a GGUF itself:
  there is no llama.cpp runtime in this environment, so narration runs only
  through a localhost model server (Odysseus / Ollama-style) when one is
  reachable. The downloaded Qwen2.5-0.5B GGUF on disk is recorded in the
  model manifest; it is NOT silently treated as loaded.
- RAM is measured with stdlib only (/proc/meminfo, /proc/self/status).
  No psutil, no torch, no cv2. Only numpy + Pillow (+ onnxruntime, optional,
  for the MobileSAM encoder when its files are present).
- No network calls at run time except to localhost model servers.
  Any probe failure -> Tier 3, never an exception to the user.
"""
import ctypes
import hashlib
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import numpy as np
from fastapi import APIRouter
from PIL import Image
from pydantic import BaseModel

from . import config

router = APIRouter()

MODELS_DIR = Path(__file__).resolve().parent / "brain" / "models"
GGUF_NAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf"
ONNX_ENCODER_NAME = "mobile_sam_image_encoder.onnx"
ONNX_DECODER_NAME = "sam_mask_decoder_single.onnx"

TIER_NAMES = {1: "Full", 2: "Light", 3: "Minimal"}
TIER_BRAINS = {
    1: "Odysseus local models (localhost)",
    2: "Local 0.5B narrator + ONNX/classical-CV pipeline",
    3: "ONNX/classical-CV pipeline only (no language model)",
}

# Requested tier (operator choice). Effective tier is computed from it.
_requested_tier = 3
_last_probe: dict = {"at": 0.0, "ollama": False, "odysseus": False}


# --------------------------------------------------------------------------
# RAM (stdlib only)
# --------------------------------------------------------------------------
def read_ram_mb() -> dict:
    """Available + total system RAM and this process's RSS, in MB.

    Uses stdlib only: /proc/meminfo on Linux, ctypes GlobalMemoryStatusEx on
    Windows. Falls back to None rather than raising on unsupported hosts.
    """
    out = {"available_mb": None, "total_mb": None, "process_mb": None}
    if sys.platform == "win32":
        try:
            class _MemoryStatusEx(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_uint32),
                    ("dwMemoryLoad", ctypes.c_uint32),
                    ("ullTotalPhys", ctypes.c_uint64),
                    ("ullAvailPhys", ctypes.c_uint64),
                    ("ullTotalPageFile", ctypes.c_uint64),
                    ("ullAvailPageFile", ctypes.c_uint64),
                    ("ullTotalVirtual", ctypes.c_uint64),
                    ("ullAvailVirtual", ctypes.c_uint64),
                    ("ullAvailExtendedVirtual", ctypes.c_uint64),
                ]

            stat = _MemoryStatusEx()
            stat.dwLength = ctypes.sizeof(_MemoryStatusEx)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                out["total_mb"] = int(stat.ullTotalPhys // (1024 * 1024))
                out["available_mb"] = int(stat.ullAvailPhys // (1024 * 1024))
        except Exception:
            pass
        try:
            class _ProcessMemCounters(ctypes.Structure):
                _fields_ = [
                    ("cb", ctypes.c_uint32),
                    ("PageFaultCount", ctypes.c_uint32),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            pmc = _ProcessMemCounters()
            pmc.cb = ctypes.sizeof(_ProcessMemCounters)
            hproc = ctypes.windll.kernel32.GetCurrentProcess()
            if ctypes.windll.psapi.GetProcessMemoryInfo(hproc, ctypes.byref(pmc), pmc.cb):
                out["process_mb"] = int(pmc.WorkingSetSize // (1024 * 1024))
        except Exception:
            pass
        return out

    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                out["available_mb"] = int(line.split()[1]) // 1024
            elif line.startswith("MemTotal:"):
                out["total_mb"] = int(line.split()[1]) // 1024
    except OSError:
        pass
    try:
        for line in Path("/proc/self/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                out["process_mb"] = int(line.split()[1]) // 1024
                break
    except OSError:
        pass
    return out


# --------------------------------------------------------------------------
# Odysseus / local model server (localhost only)
# --------------------------------------------------------------------------
def _http_get_json(url: str, timeout: float = 1.5):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def probe_model_servers(force: bool = False) -> dict:
    """Probe localhost model servers with short timeouts.

    Ollama-style API at ODYSSEUS_MODEL_URL (default http://localhost:11434/api)
    and the Odysseus workspace at http://localhost:7000. Any failure means
    "not reachable" -- never an exception.
    """
    global _last_probe
    now = time.monotonic()
    if not force and now - _last_probe["at"] < 10.0:
        return {"ollama": _last_probe["ollama"], "odysseus": _last_probe["odysseus"]}
    ollama = False
    odysseus = False
    try:
        _http_get_json(config.ODYSSEUS_MODEL_URL.rstrip("/") + "/tags", timeout=1.5)
        ollama = True
    except Exception:
        ollama = False
    try:
        req = urllib.request.Request(config.ODYSSEUS_WORKSPACE_URL, method="GET")
        with urllib.request.urlopen(req, timeout=1.5):
            odysseus = True
    except Exception:
        odysseus = False
    _last_probe = {"at": now, "ollama": ollama, "odysseus": odysseus}
    return {"ollama": ollama, "odysseus": odysseus}


def server_reachable() -> bool:
    return any(probe_model_servers().values())


def odysseus_generate(prompt: str, model: str = "", timeout: float = 30.0) -> str | None:
    """Ask the localhost model server for a short plain-language explanation.

    Ollama-style POST /api/generate. Returns the text, or None on any
    failure. The result is labelled "model output" by callers and is NEVER
    used for a measurement, a match, or a geological claim.
    """
    if not server_reachable():
        return None
    base = config.ODYSSEUS_MODEL_URL.rstrip("/")
    payload = json.dumps(
        {"model": model or "qwen2.5:0.5b", "prompt": prompt, "stream": False}
    ).encode("utf-8")
    req = urllib.request.Request(
        base + "/generate", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8")).get("response")
    except Exception:
        return None


# --------------------------------------------------------------------------
# Tier manager
# --------------------------------------------------------------------------
def models_on_disk() -> list[dict]:
    out = []
    for name in (GGUF_NAME, ONNX_ENCODER_NAME, ONNX_DECODER_NAME):
        p = MODELS_DIR / name
        if p.exists():
            out.append({"name": name, "bytes": p.stat().st_size,
                        "sha256": hashlib.sha256(p.read_bytes()).hexdigest()})
    return out


def effective_tier(requested: int | None = None) -> dict:
    """Compute the effective tier from the requested tier, RAM, and server.

    Auto-drop rules (never an error, never a fake result):
    - available RAM < 1.5 GB -> Tier 3 (not enough headroom for any model).
    - Tier 1/2 need a reachable localhost model server: this environment has
      no local GGUF runtime (no llama.cpp), so a narrator can only run
      through Odysseus/Ollama on localhost. No server -> Tier 3.
    - Tier 1 also needs enough RAM headroom for the 1.5 GB cap; otherwise
      it drops to Tier 2 (which then drops to 3 if no server).
    """
    req = requested if requested is not None else _requested_tier
    ram = read_ram_mb()
    avail = ram["available_mb"]
    servers = probe_model_servers()
    reachable = servers["ollama"] or servers["odysseus"]
    tier = req
    notes = []
    if avail is not None and avail < config.BRAIN_MODEL_MAX_RAM_MB:
        if tier != 3:
            notes.append(f"available RAM {avail} MB is below the "
                         f"{config.BRAIN_MODEL_MAX_RAM_MB} MB model cap; dropped to Tier 3")
        tier = 3
    if tier == 1 and not reachable:
        notes.append("no localhost model server reachable; Tier 1 needs Odysseus/Ollama on localhost; dropped")
        tier = 2
    if tier == 2 and not reachable:
        notes.append("no localhost model server reachable and no local GGUF runtime in this environment; dropped to Tier 3")
        tier = 3
    if tier == 1 and avail is not None and avail < config.BRAIN_TOTAL_BUDGET_MB:
        notes.append(f"available RAM {avail} MB is below the {config.BRAIN_TOTAL_BUDGET_MB} MB app+brain budget; Tier 1 dropped to Tier 2")
        tier = 2
        if not reachable:
            tier = 3
    return {"tier": tier, "tier_name": TIER_NAMES[tier],
            "brain": TIER_BRAINS[tier], "requested_tier": req,
            "ram_mb": avail, "process_mb": ram["process_mb"],
            "total_ram_mb": ram["total_mb"],
            "available": True,  # Tier 3 (classical-CV) is always available
            "model": _model_name_for_tier(tier, reachable),
            "odysseus_reachable": servers["odysseus"],
            "ollama_reachable": servers["ollama"],
            "models_on_disk": [m["name"] for m in models_on_disk()],
            "notes": notes}


def _model_name_for_tier(tier: int, reachable: bool) -> str | None:
    if tier == 3:
        return None
    if not reachable:
        return None
    return "qwen2.5:0.5b (via localhost model server)" if tier == 2 else \
        "local models via Odysseus (localhost)"


class TierRequest(BaseModel):
    tier: int


@router.get("/api/brain")
def brain_status():
    """UI badge endpoint: which tier/brain is active, RAM, availability."""
    return effective_tier()


@router.post("/api/brain/tier")
def set_tier(req: TierRequest):
    global _requested_tier
    if req.tier not in (1, 2, 3):
        from fastapi import HTTPException
        raise HTTPException(400, "tier must be 1 (Full), 2 (Light) or 3 (Minimal)")
    _requested_tier = req.tier
    status = effective_tier()
    status["requested_tier_set"] = req.tier
    return status


# --------------------------------------------------------------------------
# Classical-CV measurement pipeline (numpy + Pillow only; ALWAYS ON)
# --------------------------------------------------------------------------
def _otsu_threshold(gray: np.ndarray) -> int:
    """Otsu's threshold, implemented in numpy on a 256-bin histogram."""
    hist = np.bincount(gray.ravel(), minlength=256).astype(np.float64)
    total = gray.size
    w0 = np.cumsum(hist)
    w1 = total - w0
    centres = np.arange(256, dtype=np.float64)
    m0 = np.cumsum(hist * centres)
    mt = m0[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        mu0 = np.where(w0 > 0, m0 / np.where(w0 == 0, 1, w0), 0.0)
        mu1 = np.where(w1 > 0, (mt - m0) / np.where(w1 == 0, 1, w1), 0.0)
        between = w0 * w1 * (mu0 - mu1) ** 2
    between[(w0 == 0) | (w1 == 0)] = -1.0
    return int(np.argmax(between))


def _local_std(gray: np.ndarray, k: int = 5) -> np.ndarray:
    """Local standard deviation over a kxk window via integral images."""
    pad = k // 2
    padded = np.pad(gray, pad, mode="reflect")
    csum = np.cumsum(np.cumsum(padded, axis=0), axis=1)
    csum = np.pad(csum, ((1, 0), (1, 0)))
    def box_sum(a):
        return (a[k:, k:] - a[:-k, k:] - a[k:, :-k] + a[:-k, :-k])
    n = float(k * k)
    mean = box_sum(csum) / n
    sq = padded.astype(np.float64) ** 2
    csum_sq = np.pad(np.cumsum(np.cumsum(sq, axis=0), axis=1), ((1, 0), (1, 0)))
    mean_sq = box_sum(csum_sq) / n
    var = np.clip(mean_sq - mean ** 2, 0.0, None)
    return np.sqrt(var)


def _connected_components(mask: np.ndarray) -> int:
    """Count 4-connected components of a small boolean mask (BFS, seeded).

    The mask is downsampled to at most 64x64 first, so the count is
    deterministic and cheap. Method is documented in the measurement row.
    """
    h, w = mask.shape
    sh, sw = max(1, h // 64), max(1, w // 64)
    small = mask[::sh, ::sw]
    seen = np.zeros_like(small, dtype=bool)
    count = 0
    hh, ww = small.shape
    for r in range(hh):
        for c in range(ww):
            if small[r, c] and not seen[r, c]:
                count += 1
                stack = [(r, c)]
                seen[r, c] = True
                while stack:
                    y, x = stack.pop()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < hh and 0 <= nx < ww and small[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
    return count


def _histogram(rgb: np.ndarray, bins: int = 8) -> list[float]:
    """Normalised per-channel colour histogram (bins per channel)."""
    out: list[float] = []
    for ch in range(3):
        h, _ = np.histogram(rgb[:, :, ch], bins=bins, range=(0, 256))
        out.extend((h / max(1, rgb.shape[0] * rgb.shape[1])).tolist())
    return [round(float(v), 6) for v in out]


def measure_image(image: Image.Image, scale_m_per_px: float | None = None) -> dict:
    """Defensible measurements from one image. Deterministic: same pixels
    always give the same numbers (no randomness; seed logged by callers).

    Returns measurements (each with value, unit, method, uncertainty),
    the 6-dim shared feature vector used for archive matching, colour
    histograms, and the Otsu segmentation fractions.
    """
    rgb = np.asarray(image.convert("RGB")).astype(np.float64)
    h, w, _ = rgb.shape
    gray = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    gray_u8 = np.clip(gray, 0, 255).astype(np.uint8)

    t = _otsu_threshold(gray_u8)
    # Three-class split: Otsu on the dark half and on the bright half.
    dark_part = gray_u8[gray_u8 <= t]
    bright_part = gray_u8[gray_u8 > t]
    t_dark = _otsu_threshold(dark_part) if dark_part.size else t
    t_bright = _otsu_threshold(bright_part) if bright_part.size else t
    dark_mask = gray <= t_dark
    bright_mask = gray >= max(t_bright, t + 1)
    mid_mask = ~(dark_mask | bright_mask)
    if gray.std() < 1.0:
        # Degenerate image (near-constant tone): Otsu has no spread to split,
        # so a threshold split would be meaningless. Classify the whole image
        # by its mean luminance instead.
        mean_dn = float(gray.mean())
        dark_mask = np.full(gray.shape, mean_dn < 85.0)
        bright_mask = np.full(gray.shape, mean_dn > 170.0)
        mid_mask = ~(dark_mask | bright_mask)
    n = float(h * w)
    frac_dark, frac_mid, frac_bright = (float(dark_mask.mean()), float(mid_mask.mean()), float(bright_mask.mean()))

    gy, gx = np.gradient(gray / 255.0)
    grad_mag = np.sqrt(gx ** 2 + gy ** 2)
    edge_density = float((grad_mag > 0.12).mean())
    texture = _local_std(gray / 255.0)
    local_var_mean = float(texture.mean())

    subfeatures = _connected_components(bright_mask | dark_mask)
    hist = _histogram(np.asarray(image.convert("RGB")))

    mean_rgb = rgb.mean(axis=(0, 1))
    median_rgb = np.median(rgb, axis=(0, 1))
    gray_mean = float(gray.mean())
    gray_std = float(gray.std())

    scale_note = ("no scale provided — sizes are in pixels only"
                  if scale_m_per_px is None else
                  f"scale {scale_m_per_px} m/px provided by the scientist")
    area_unit = "px" if scale_m_per_px is None else "m^2"
    def area(px: float) -> float:
        return px if scale_m_per_px is None else px * scale_m_per_px ** 2

    measurements = [
        {"name": "image width", "value": w, "unit": "px", "method": "PIL image size",
         "uncertainty": "exact"},
        {"name": "image height", "value": h, "unit": "px", "method": "PIL image size",
         "uncertainty": "exact"},
        {"name": "mean red", "value": round(float(mean_rgb[0]), 2), "unit": "DN (0-255)",
         "method": "mean of red channel over all pixels", "uncertainty": f"std {float(rgb[:, :, 0].std()):.2f}"},
        {"name": "mean green", "value": round(float(mean_rgb[1]), 2), "unit": "DN (0-255)",
         "method": "mean of green channel over all pixels", "uncertainty": f"std {float(rgb[:, :, 1].std()):.2f}"},
        {"name": "mean blue", "value": round(float(mean_rgb[2]), 2), "unit": "DN (0-255)",
         "method": "mean of blue channel over all pixels", "uncertainty": f"std {float(rgb[:, :, 2].std()):.2f}"},
        {"name": "median red", "value": round(float(median_rgb[0]), 2), "unit": "DN (0-255)",
         "method": "median of red channel over all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "median green", "value": round(float(median_rgb[1]), 2), "unit": "DN (0-255)",
         "method": "median of green channel over all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "median blue", "value": round(float(median_rgb[2]), 2), "unit": "DN (0-255)",
         "method": "median of blue channel over all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "mean luminance", "value": round(gray_mean, 2), "unit": "DN (0-255)",
         "method": "0.299R+0.587G+0.114B, mean over all pixels", "uncertainty": f"std {gray_std:.2f}"},
        {"name": "luminance std", "value": round(gray_std, 4), "unit": "DN (0-255)",
         "method": "standard deviation of luminance over all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "Otsu threshold", "value": t, "unit": "DN (0-255)",
         "method": "Otsu threshold on 256-bin luminance histogram (numpy)",
         "uncertainty": "uncertainty not quantified"},
        {"name": "dark region area", "value": round(area(float(dark_mask.sum())), 2),
         "unit": area_unit, "method": f"Otsu 3-class segmentation (dark <= {t_dark} DN); {scale_note}",
         "uncertainty": "uncertainty not quantified"},
        {"name": "mid-tone region area", "value": round(area(float(mid_mask.sum())), 2),
         "unit": area_unit, "method": f"Otsu 3-class segmentation; {scale_note}",
         "uncertainty": "uncertainty not quantified"},
        {"name": "bright region area", "value": round(area(float(bright_mask.sum())), 2),
         "unit": area_unit, "method": f"Otsu 3-class segmentation (bright >= {max(t_bright, t + 1)} DN); {scale_note}",
         "uncertainty": "uncertainty not quantified"},
        {"name": "dark region fraction", "value": round(frac_dark, 4), "unit": "fraction",
         "method": "Otsu 3-class segmentation, dark pixels / all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "mid-tone region fraction", "value": round(frac_mid, 4), "unit": "fraction",
         "method": "Otsu 3-class segmentation, mid-tone pixels / all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "bright region fraction", "value": round(frac_bright, 4), "unit": "fraction",
         "method": "Otsu 3-class segmentation, bright pixels / all pixels", "uncertainty": "uncertainty not quantified"},
        {"name": "local texture (mean local std)", "value": round(local_var_mean, 4),
         "unit": "DN fraction (0-1)", "method": "mean 5x5 local standard deviation of luminance (integral image)",
         "uncertainty": "uncertainty not quantified"},
        {"name": "edge density", "value": round(edge_density, 4), "unit": "fraction",
         "method": "fraction of pixels with numpy gradient magnitude > 0.12",
         "uncertainty": "uncertainty not quantified"},
        {"name": "distinct sub-features", "value": subfeatures, "unit": "count",
         "method": "4-connected components of the dark+bright mask, downsampled to <=64x64 (BFS)",
         "uncertainty": "count depends on the downsampling; treat as an indicator, not a census"},
    ]

    # Shared 6-dim descriptor space with the archive (see jezero_seed.json):
    # [mean R, mean G, mean B, luminance std, edge density, bright fraction],
    # each 0..1. Archive vectors are representative descriptors estimated
    # from published tone descriptions, NOT measured from images -- the
    # seed file says so, and matches are labelled "model output".
    feature_vector = [
        round(float(mean_rgb[0]) / 255.0, 6),
        round(float(mean_rgb[1]) / 255.0, 6),
        round(float(mean_rgb[2]) / 255.0, 6),
        round(gray_std / 255.0, 6),
        round(edge_density, 6),
        round(frac_bright, 6),
    ]
    return {"measurements": measurements, "feature_vector": feature_vector,
            "colour_histogram_8bin": hist, "otsu_threshold": t,
            "fractions": {"dark": frac_dark, "mid": frac_mid, "bright": frac_bright},
            "scale_note": scale_note}


# --------------------------------------------------------------------------
# Optional ONNX segmentation (MobileSAM encoder + single-mask decoder)
# --------------------------------------------------------------------------
def onnx_segment(image: Image.Image) -> dict | None:
    """Run the bundled MobileSAM ONNX encoder/decoder (CPU) if available.

    Prompted with the image centre point. Returns the mask area fraction
    and the decoder's IoU prediction, or None if onnxruntime or the model
    files are unavailable or the run fails. This is a "model output":
    it never replaces the classical-CV measurements above.
    """
    try:
        import onnxruntime as ort
    except ImportError:
        return None
    enc_path = MODELS_DIR / ONNX_ENCODER_NAME
    dec_path = MODELS_DIR / ONNX_DECODER_NAME
    if not enc_path.exists() or not dec_path.exists():
        return None
    try:
        arr = np.asarray(image.convert("RGB").resize((1024, 1024))).astype(np.float32)
        enc = ort.InferenceSession(str(enc_path), providers=["CPUExecutionProvider"])
        emb = enc.run(None, {"input_image": arr})[0]
        dec = ort.InferenceSession(str(dec_path), providers=["CPUExecutionProvider"])
        masks, iou, _ = dec.run(None, {
            "image_embeddings": emb,
            "point_coords": np.array([[[512.0, 512.0]]], dtype=np.float32),
            "point_labels": np.array([[1]], dtype=np.float32),
            "mask_input": np.zeros((1, 1, 256, 256), dtype=np.float32),
            "has_mask_input": np.array([0], dtype=np.float32),
            "orig_im_size": np.array([1024, 1024], dtype=np.float32),
        })
        mask = masks[0, 0] > 0.0
        return {"method": "MobileSAM ONNX (Acly export), centre-point prompt, CPU",
                "mask_area_fraction": round(float(mask.mean()), 4),
                "iou_prediction": round(float(iou[0][0]), 4),
                "label": "model output"}
    except Exception:
        return None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
