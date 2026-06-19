# Production image for the growpod Python game API — the GrowVerse backend that
# serves /api/game/* (players, economy, breeding, market, …) via Flask+gunicorn.
#
# Build context is growpod/. Ship COMMITTED CODE ONLY: build/deploy from a clean
# worktree at HEAD so the uncommitted staking work is never included — see
# docs/DEPLOY_FLY.md. Created at "Gate A"; not deployed yet.
FROM python:3.12-slim

# Quiet, unbuffered logs; src-layout imports (mirrors render.yaml PYTHONPATH=src).
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=src \
    PORT=8080

WORKDIR /app

# Install runtime deps first so this layer caches across code-only changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Non-root runtime user (container hardening). Owns /app so the app can write
# (e.g. the SQLite fallback in non-prod); prod uses Postgres and writes nothing.
RUN useradd --system --create-home --uid 10001 appuser

# Application source. .dockerignore trims dev cruft (venv, dev SQLite db, the
# web/ Next app, the Node artifacts/, tests, caches) so they never ship.
COPY . .
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# 2 sync workers — matches the proven render.yaml start command.
# Migrations + seed run separately via fly.toml [deploy] release_command.
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "2", "server:app"]
