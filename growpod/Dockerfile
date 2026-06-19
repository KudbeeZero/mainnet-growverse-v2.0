# FRONTIER backend (GROWv2 / package `growpodempire`) — Flask API served by
# gunicorn. Build context is this directory (growpod/). See docs/DEPLOY_FLY.md.
#
# This mirrors the existing Render deploy (render.yaml): same start command,
# same PYTHONPATH=src layout, same gunicorn worker count. Nothing about app
# behavior changes — the container only sets PORT/host so it runs cleanly.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=src \
    PORT=8080

WORKDIR /app

# Install dependencies first for layer caching. requirements.txt is the
# backend's pinned dependency manifest; psycopg2-binary / pynacl ship manylinux
# wheels, so no system compiler is required on python:3.11-slim.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Application code. server.py exposes `app` (the Flask app factory result); the
# growpodempire package lives under src/ (PYTHONPATH=src). alembic/ + alembic.ini
# are included so the Fly release_command can run migrations.
COPY server.py alembic.ini ./
COPY alembic ./alembic
COPY src ./src

EXPOSE 8080

# Bind to 0.0.0.0:$PORT so Fly can route to the container. -w 2 mirrors Render.
CMD ["sh", "-c", "exec gunicorn -b 0.0.0.0:${PORT:-8080} -w 2 server:app"]
