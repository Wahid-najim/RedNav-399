# VERIFICATION LOG — Research Lab backend (RedNav-N399)

Everything the backend agent downloaded and checked itself, every
disagreement found, every fallback used, and every value that could NOT
be verified. Written 2026-11-11. Nothing here is faked: if a download or
a check failed, it says so and names the fallback.

## 1. Models downloaded (all on Earth / in this sandbox, never at run time)

### Qwen2.5-0.5B-Instruct Q4_K_M (GGUF) — DOWNLOADED, hash-verified
- URL: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
- File: `backend/app/brain/models/qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Size: 491,400,032 bytes — matches the official HuggingFace file listing exactly
- SHA-256: `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`
- Magic bytes: `GGUF` (verified)
- Licence: Apache-2.0 (confirmed via the HuggingFace API; repo commit `9217f5db79a29953eb74d5343926648285ec7e67`, 2024-09-20)
- Role: narrator only (Tier 2). Never measures, never matches, never concludes.
- Status: **downloaded but NOT runnable in this environment** — no local GGUF
  runtime exists here (no llama.cpp installed, per the task; no Ollama server
  running). The backend therefore auto-drops to Tier 3 when no localhost model
  server is reachable. The model will run when Odysseus / Ollama serves it on
  localhost (`ODYSSEUS_MODEL_URL`, default `http://localhost:11434/api`).
- No 7B+ model was attempted or downloaded. A 7B Q4 (~4.3 GB) breaks the
  1.5 GB per-model cap and was never tried.

### MobileSAM image encoder + single-mask decoder (ONNX) — DOWNLOADED, hash-verified, RUN
- Source: Acly/MobileSAM export on HuggingFace (MobileSAM by Chaoning Zhang et al.)
- URLs: https://huggingface.co/Acly/MobileSAM
- Files: `mobile_sam_image_encoder.onnx` (28,157,093 bytes),
  `sam_mask_decoder_single.onnx` (16,501,323 bytes) — both sizes match the
  official HuggingFace listing exactly
- SHA-256 encoder: `580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749`
- SHA-256 decoder: `93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d`
- Licence: Apache-2.0 (MobileSAM); Acly ONNX export MIT
- Offline test (2026-11-11, onnxruntime 1.31.1, CPU, network off): encoder ran on
  a 1024x1024x3 float32 input and returned embeddings (1, 256, 64, 64); decoder
  interface verified. Also used live in the analysis pipeline (centre-point
  prompt) — see §5 for a quirk found there.
- Full manifest: `backend/app/brain/models/MODEL_MANIFEST.md`. Model files are
  NOT committed to git (`.gitignore`: `backend/app/brain/models/*.gguf`, `*.onnx`);
  re-download from the URLs above and check the SHA-256.

### Dependencies added (all actually used)
- `onnxruntime>=1.31` (installed 1.31.1; used for the MobileSAM encoder/decoder)
- `pillow>=10.0` (installed 13.0.0; was already present but unlisted — now pinned)
- `python-multipart>=0.0.9` (required by FastAPI for image upload; was missing)
- NOT installed: torch, cv2, llama.cpp, psutil, PathCORE-T, Pathcore.io.

## 2. "PathCore" — VERIFIED, not a Mars tool, not installed
- Web check 2026-11-11: **PathCORE-T** is a transcriptomics co-occurrence
  method — Chen et al. 2018, *BioData Mining* 11:14, doi:10.1186/s13040-018-0175-7,
  repo `github.com/greenelab/PathCORE-T`. It finds pathways co-occurring in
  gene-expression features more often than expected by chance. It is NOT an
  image tool and NOT a Mars tool.
- **Pathcore.io** is a separate digital-pathology company (microscope slides).
- Neither was installed. The pattern finder is a local implementation in
  `backend/app/pattern_finder.py`: feature co-occurrence counts across archive
  entries, expected frequency under independence, pairs above baseline with n
  and baseline shown. Label: "pattern-finder (local implementation, inspired by
  the co-occurrence idea behind PathCORE-T)" — never "PathCore".

## 3. "Odysseus" — VERIFIED (web), not running here, not bundled
- Web check 2026-11-11: Odysseus is a free, self-hosted AI workspace by
  PewDiePie — repo `github.com/pewdiepie-archdaemon/odysseus`, licence
  **AGPL-3.0** (AGPL-3.0-or-later), Docker install, web UI at
  `http://localhost:7000`. Confirmed by multiple sources (repo README via a
  fork mirror; modelfit.io; odysseusai.dev; codewithromi.com).
- Corrections to the prompt's description, found in the check:
  - The repo has moved to the `odysseus-dev` GitHub organisation (July 2026);
    the old `pewdiepie-archdaemon/odysseus` address redirects there.
  - Version is 1.0.3 with no release tags (rolling `main`/`dev` branches).
  - **Odysseus ships with NO model inside it.** Models come from a local
    backend the user connects (Ollama at `http://localhost:11434/v1`).
    Odysseus is a workspace, not a model — the backend treats it that way.
  - A separate "Ajax" model (Qwen 3.5 9B fine-tune) was announced Oct 2026
    but is NOT downloadable (no weights, no licence, no date as of the check).
- Not verified in this sandbox: the repo was not cloned and Odysseus was not
  run here (no Docker/Ollama in this VM; the backend's localhost probes to
  `:11434` and `:7000` both report unreachable, and the code drops to Tier 3).
- AGPL note: Odysseus is NOT bundled with this app — the backend only talks
  to it over localhost when it is running. If it is ever bundled or
  distributed with this app, the AGPL-3.0 obligations (including sharing
  changes when run as a network service) must be recorded in the README first.

## 4. Seed archive verification
- `backend/scripts/verify_archive.py` re-reads `jezeroVerified.ts` and checks
  every transcribed number in `backend/app/archive/jezero_seed.json`:
  **595 numeric tokens checked, all found in the TS. Exit 0.**
- Skipped by design (labelled in the seed): Belva Crater coordinates
  (18.48°N, 77.38°E) and elevation (−2,489 m) — from the RedNav master prompt /
  CTX DTM patch (IAU Feature 15872; USGS CTX 20 m DTM DOI 10.5066/P906QQT8),
  NOT from `jezeroVerified.ts`; and all `descriptor_vector` arrays.
- **NOT verified: the two Jezero PDFs.** Only the TS was on disk in this
  sandbox, so no PDF cross-check was possible. Where the TS and the PDFs
  disagree, the PDFs win — that check still needs doing with the PDFs in hand.
- Archive descriptor vectors are **representative estimates** from the
  published tone descriptions ("light-toned", "dark olivine-rich basalt"),
  NOT measured from images and NOT published values. They exist only so
  cosine similarity can be computed in a shared space. Every match is
  labelled "model output" and is a similarity score, not a geological claim.
  The 6-dim cosine space is coarse: a reddish noise image scored 0.86–0.91
  against five archive features. The 0.5 threshold is the contract; the
  scores must not be read as geological confidence.

## 5. Fallbacks used (all by design, all labelled)
- **Tier 3 Minimal is the working tier in this sandbox** (no localhost model
  server; `GET /api/brain` reports tier 3, model null, available true).
  Measurements, matches, novelty, actions and unknowns all work in Tier 3;
  `brain_explanation` is null and the unknowns say why.
- **Classical-CV is the measurement authority** (numpy + Pillow Otsu
  segmentation, colour histograms, local variance, edge density). The ONNX
  segmentation is optional and labelled "model output".
- **ONNX quirk found 2026-11-11:** on a featureless noise image the
  centre-point-prompted MobileSAM decoder returns a full-frame mask
  (mask_area_fraction 1.0, IoU prediction 1.0083 — above 1, uncalibrated on
  this input). The decoder is prompt-driven, not a scene segmenter; its
  output is recorded as model output and never replaces a CV measurement.
- **Degenerate-image fix:** a near-constant image (gray std < 1) made Otsu
  meaningless and the flat blue test image was classified "bright". The
  pipeline now classifies such images by mean luminance (<85 dark, >170
  bright, else mid). Found by the non-Mars test; fixed in `brain.py`.
- **No scale:** sizes are reported in pixels with "no scale provided — sizes
  are in pixels only". No scale is ever invented.
- **No archive images:** the seed archive holds published values and
  descriptions, not image files, so `thumbnail_url` is always null. Never
  invent a thumbnail.

## 6. Routing guard — verified live
- The data agent delivered the real region during this build:
  `data/processed/jezero_delta` now has the measured CTX 20 m DTM
  (resampled to a 50 m, 400x400 grid; topographic layer DOI 10.5066/P906QQT8),
  real sites (landing 18.4446/77.4509, Kodiak 18.4124/77.382, Belva 18.48/77.38,
  Séítah, Mandu Wall, delta front) and null-lat sites (Bright Angel, Cheyava
  Falls, Broom Point).
- **Bug found and fixed during this build:** `POST /api/route` on the real
  region crashed with a 500 (`TypeError` in `latlon_to_cell`, `None` lat)
  because `routed_detours` iterated ALL sites including null-lat ones.
  Fixed in `backend/app/routing/explain.py` (null-lat sites skipped in
  detours and hazard-distance checks) and hardened in `backend/app/store.py`
  (`hazard_mask`, `chem_at`).
- Verified after the fix (TestClient): landing → Kodiak returns a route
  (balanced, 4,707.7 m); goal `cheyava_falls` / `bright_angel` / `broom_point`
  → HTTP 400 "site … has no published location — cannot route to it".

## 7. What could NOT be verified
- The two Jezero PDFs (not on disk here) — see §4.
- Odysseus running (not installed in this VM) and the Qwen GGUF running
  (no local GGUF runtime) — see §1, §3. Tier 1/2 behaviour with a live
  server is therefore untested; only the auto-drop to Tier 3 is tested.
- RAM on Aizen's machine: this VM reports 1,602 MB available, which is
  just above the 1,536 MB model cap. On the 8 GB MSI Modern 14 the numbers
  will differ; Tier 1/2 RAM behaviour must be re-checked there.
- The novelty σ method (distance from the 6-zone mean, divided by the
  zones' own distance std) is a defined method, not a published one; with
  n = 6 the σ values run high (8.06σ on a noise image). The population and
  n are always shown next to the score.
- HiRISE 1 m DTM layer, CTX 6 m ortho basemap, 3D HUD scene: not part of
  this backend task; still open (see Mars_Maps CTX patch notes).
- The frontend Research Lab UI builds against the contract in
  `docs/API_SPEC.md`; it was not tested here (frontend is another agent's).

## 8. Tests
- `.venv/bin/python -m pytest backend/tests -q`: **38 passed** (25 baseline +
  13 new: 7 brain, 6 research-lab, including the real-DEM landing→Kodiak
  route test, which runs now that the data agent delivered the CTX region).
- `backend/scripts/verify_archive.py`: 595 tokens OK (see §4).
- End-to-end TestClient flow (201 analyse → list → get → image → bundle ZIP
  with analysis.json, report.md, image, manifest.json) verified 2026-11-11;
  the demo row was removed afterwards, leaving an empty local DB.
