.PHONY: demo api web test validate
# Use the project venv when it exists, else python3 (bare `python` is not
# on PATH on many machines, including this build VM). Absolute path: the
# test recipe runs from backend/, so a relative path would break there.
PY := $(if $(wildcard .venv/bin/python),$(CURDIR)/.venv/bin/python,python3)
demo:   ## synthetic regions (demo + Jezero + 5 Bangladesh craters) so everyone can start now
	$(PY) data/scripts/run_all.py --full-demo
api:
	cd backend && uvicorn app.main:app --reload --port 8000
web:
	cd frontend && npm install && npm run dev
test:
	cd backend && $(PY) -m pytest -q
validate: ## evidence for docs/VALIDATION.md
	$(PY) backend/scripts/validate.py
