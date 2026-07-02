# Root-level Dockerfile for Fly.io so `flyctl launch` / `fly deploy` detects a
# runtime when run from the REPOSITORY ROOT (this is where Fly looks by default).
#
# The FRONTIER backend is a Python/Flask app that lives in growpod/ (package
# `growpodempire`, src/ layout), served by gunicorn — identical to the existing
# Render deploy (growpod/render.yaml). This file builds that backend from the
# repo root build context. (growpod/Dockerfile is the same image for when you
# instead run Fly from inside growpod/.)
#
# Nothing about app behavior changes — the container only sets PORT/host so it
# runs cleanly. No economy/chain/DB/schema/frontend changes.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=src \
    PORT=8080

WORKDIR /app

# Install dependencies first for layer caching. growpod/requirements.txt is the
# backend's pinned manifest; psycopg2-binary / pynacl ship manylinux wheels, so
# no system compiler is required on python:3.11-slim.
COPY growpod/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Non-root runtime user (container hardening — mirrors growpod/Dockerfile). A
# process compromise then can't run as root inside the container. Prod uses
# Postgres and writes nothing to /app, so read-only app code is fine.
RUN useradd --system --create-home --uid 10001 appuser

# Application code. server.py exposes `app` (the Flask app factory result); the
# growpodempire package lives under src/ (PYTHONPATH=src). alembic/ + alembic.ini
# are included so the Fly release_command can run migrations.
COPY growpod/server.py growpod/alembic.ini ./
COPY growpod/alembic ./alembic
COPY growpod/src ./src

USER appuser

EXPOSE 8080

# Bind to 0.0.0.0:$PORT so Fly can route to the container. -w 2 mirrors Render.
CMD ["sh", "-c", "exec gunicorn -b 0.0.0.0:${PORT:-8080} -w 2 server:app"]
