# GROWv2 developer tasks. Local devs: `make setup` once, then `make test`.
# A venv is used so installs never collide with system packages (e.g. a
# distro-managed PyYAML, which is what breaks a bare `pip install` on some boxes).
.PHONY: setup test lint check-memory check-migrations serve clean

VENV ?= .venv
PY := $(VENV)/bin/python

setup: ## Create a venv and install runtime + dev deps + the package (editable)
	python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r requirements.txt -r requirements-dev.txt ruff
	$(PY) -m pip install -e .
	@echo "Done. Run 'make test' (or activate with 'source $(VENV)/bin/activate')."

test: ## Run the full test suite (with the coverage gate)
	$(PY) -m pytest -q --cov --cov-report=term-missing

lint: ## Run the same lint gate CI uses
	$(PY) -m ruff check --select=E9,F63,F7,F82 src tests

check-memory: ## Validate the memory layer (links, ✅ citations, structure)
	$(PY) scripts/check_memory.py

check-migrations: ## Fail if the Alembic graph has more than one head (forks)
	$(PY) scripts/check_single_head.py

serve: ## Run the API locally
	$(PY) server.py

clean: ## Remove the venv and caches
	rm -rf $(VENV) .pytest_cache **/__pycache__
