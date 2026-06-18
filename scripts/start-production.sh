#!/bin/bash
set -e

# Production startup script for GrowPod Empire.
#
# Architecture:
#   - Next.js (frontend) binds to $PORT (Autoscale-assigned, falls back to 3000).
#     This is the only externally reachable service; external port 80 → $PORT.
#   - Gunicorn (API) binds to 0.0.0.0:8000 — internal only.
#     Next.js rewrites proxy /api/* and /health to http://localhost:8000.

# Resolve paths relative to this script so it works on any host
# (not tied to a specific deploy platform's directory layout).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ------------------------------------------------------------------
# 1. Schema init (idempotent — creates tables if missing, safe to re-run)
# ------------------------------------------------------------------
cd "$REPO_ROOT/growpod"
export PYTHONPATH=src
python3 -c "from growpodempire.db.session import init_db; init_db()"

# ------------------------------------------------------------------
# 2. Start the Gunicorn API backend (internal, port 8000)
# ------------------------------------------------------------------
python3 -m gunicorn server:app \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile - &
API_PID=$!

# ------------------------------------------------------------------
# 3. Start the Next.js frontend on the Autoscale-assigned PORT
# ------------------------------------------------------------------
cd "$REPO_ROOT/growpod/web"
NEXT_PORT="${PORT:-3000}"
BACKEND_URL=http://localhost:8000 npm run start -- -p "$NEXT_PORT" &
WEB_PID=$!

# ------------------------------------------------------------------
# 4. Keep the container alive; forward SIGTERM/SIGINT to children
# ------------------------------------------------------------------
trap "kill \$API_PID \$WEB_PID 2>/dev/null; wait; exit 0" INT TERM
wait $API_PID $WEB_PID
