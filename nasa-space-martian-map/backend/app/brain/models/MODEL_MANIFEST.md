# Model manifest — Research Lab brain (RedNav-N399)

Every model the backend uses or has downloaded, with name, version, URL,
SHA-256, licence, and offline-test result. Nothing here is downloaded at
run time; all files were downloaded on Earth (2026-11-11, in this sandbox)
and are recorded here. Large model files are NOT committed to git
(see `.gitignore`: `backend/app/brain/models/*.gguf`, `*.onnx`) — re-download
them from the URLs below and check the SHA-256.

## Qwen2.5-0.5B-Instruct Q4_K_M (GGUF) — narrator, Tier 2

- Name: Qwen2.5-0.5B-Instruct, quantised Q4_K_M (GGUF)
- File: `backend/app/brain/models/qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Version / repo commit: Qwen/Qwen2.5-0.5B-Instruct-GGUF, HF commit `9217f5db79a29953eb74d5343926648285ec7e67`, last modified 2024-09-20
- URL: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
- Size: 491,400,032 bytes (matches the official HuggingFace file listing exactly)
- SHA-256: `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`
- Magic bytes: `GGUF` (verified)
- Licence: Apache-2.0 (confirmed via the HuggingFace API, `license:apache-2.0`)
- Role: plain-language narrator only (Tier 2 LIGHT). It only turns measurements
  into readable sentences; it never measures, matches, or draws conclusions.
- Status: **downloaded and hash-verified, but NOT runnable in this environment
  yet** — there is no local GGUF runtime here (no llama.cpp, no Ollama server
  running; per the task, llama.cpp was not installed). The backend therefore
  auto-drops to Tier 3 (Minimal) when no localhost model server is reachable.
  The model runs when Odysseus / an Ollama-style server on localhost serves it
  (env `ODYSSEUS_MODEL_URL`, default `http://localhost:11434/api`).
- RAM: 491 MB on disk; loaded Q4_K_M 0.5B needs roughly 0.5–0.7 GB RAM, inside
  the 1.5 GB per-model cap (Section 2b). Not measured running — no runtime here.

## MobileSAM image encoder + single-mask decoder (ONNX) — segmentation, always-on path

- Files: `backend/app/brain/models/mobile_sam_image_encoder.onnx` (28,157,093 bytes),
  `backend/app/brain/models/sam_mask_decoder_single.onnx` (16,501,323 bytes)
- Source: Acly/MobileSAM export on HuggingFace (MobileSAM by Chaoning Zhang et al.)
- URLs: https://huggingface.co/Acly/MobileSAM
- Sizes: match the official HuggingFace file listing exactly
- SHA-256 encoder: `580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749`
- SHA-256 decoder: `93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d`
- Licence: Apache-2.0 (MobileSAM); the Acly ONNX export is MIT-licensed
- Role: optional segmentation. Centre-point prompt -> mask area fraction +
  IoU prediction, labelled "model output". The classical-CV pipeline
  (numpy + Pillow Otsu) does all the measuring and works without it.
- Offline test (2026-11-11, this VM, onnxruntime 1.31.1, CPU): encoder ran on a
  1024x1024x3 float32 input and returned embeddings of shape (1, 256, 64, 64);
  decoder interface verified (image_embeddings, point_coords, point_labels,
  mask_input, has_mask_input, orig_im_size). Runs with the network off.

## No 7B+ model

No model larger than 0.5B was attempted or downloaded. A 7B Q4 model
(~4.3 GB) does not fit the 1.5 GB per-model cap on the 8 GB machine
(Section 2b) and was never tried.

## What is NOT a model

- Odysseus is a workspace, not a model. It hosts local models over
  localhost (workspace http://localhost:7000, model API
  http://localhost:11434/api). It is not bundled here; the backend only
  talks to it over localhost when it is running.
- The classical-CV pipeline (Otsu segmentation, colour histograms, texture)
  is code, not a model. It is always on and needs no download.
