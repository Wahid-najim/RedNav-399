"""Verify the Research Lab seed archive against jezeroVerified.ts.

Re-reads the TS file and checks that every transcribed number in
backend/app/archive/jezero_seed.json appears in it. Skips:
- descriptor_vector arrays (representative estimates, NOT published values
  -- labelled as such in the seed file),
- entries with "verify_in_ts": false (Belva coordinates/elevation, which
  come from the RedNav master prompt / CTX DTM patch, not from the TS),
- the meta / not_published sections (free text, not transcribed values).

Where the TS and the PDFs disagree, the PDFs win -- but only the TS was on
disk in this sandbox, so no PDF cross-check was possible here; that is
recorded in docs/VERIFICATION_LOG.md.

Usage: .venv/bin/python backend/scripts/verify_archive.py
Exit 0 = every checked number found; exit 1 = failures listed.
"""
import json
import re
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TS_PATH = Path.home() / "workspace" / "your_files" / "mars-maps-jezero-update" / "jezeroVerified.ts"
SEED_PATH = ROOT / "backend" / "app" / "archive" / "jezero_seed.json"

SECTIONS = ["crater", "elevations", "atmosphere", "weather", "chemistry_floor",
            "margin", "samples_moxie", "images", "zones", "sites", "features",
            "citations"]
NUM_RE = re.compile(r"(?<![\d.])-?\d+(?:\.\d+)?")  # a '-' after a digit is a range hyphen, not a minus sign


def fmt_number(v) -> str:
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, int):
        return str(v)
    r = repr(float(v))
    if "e" in r or "E" in r:
        return format(Decimal(r), "f")
    return r


def collect(node, path, out):
    if isinstance(node, dict):
        if node.get("verify_in_ts") is False:
            return
        for k, v in node.items():
            if k == "descriptor_vector":
                continue
            collect(v, f"{path}.{k}", out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            collect(v, f"{path}[{i}]", out)
    elif isinstance(node, (int, float)) and not isinstance(node, bool):
        out.append((fmt_number(node), path))
    elif isinstance(node, str):
        for tok in NUM_RE.findall(node):
            out.append((tok, path))


def main() -> int:
    ts = TS_PATH.read_text(encoding="utf-8")
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    tokens: list[tuple[str, str]] = []
    for section in SECTIONS:
        collect(seed[section], section, tokens)
    missing = [(tok, path) for tok, path in tokens if tok not in ts]
    print(f"checked {len(tokens)} numeric tokens from {len(SECTIONS)} seed sections")
    print(f"TS source: {TS_PATH}")
    if missing:
        print(f"FAIL: {len(missing)} tokens NOT found in jezeroVerified.ts:")
        for tok, path in sorted(set(missing)):
            print(f"  {tok!r} at {path}")
        return 1
    print("OK: every transcribed number appears in jezeroVerified.ts")
    skipped = [f["id"] for f in seed["features"] if f.get("verify_in_ts") is False]
    skipped += [s["id"] for s in seed["sites"] if s.get("verify_in_ts") is False]
    print(f"skipped (not from the TS, labelled in the seed): {sorted(set(skipped))} + all descriptor_vector arrays")
    return 0


if __name__ == "__main__":
    sys.exit(main())
