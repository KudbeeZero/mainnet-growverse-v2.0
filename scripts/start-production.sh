#!/bin/bash
set -e

# Production startup script for GrowPod Empire.
# Launches both the Python/Gunicorn API and the Next.js web frontend.
# Both services run in the same container; the Next.js rewrites proxy
# /api/* requests to the backend.

# ------------------------------------------------------------------
# 1. Database bootstrap (idempotent — safe to re-run on restart)
# ------------------------------------------------------------------
cd /home/runner/workspace/growpod
PYTHONPATH=src python3 -c "from growpodempire.db.session import init_db; init_db()"
PYTHONPATH=src python3 -m growpodempire.db.seed

# ------------------------------------------------------------------
# 2. Start the API backend (port 8000)
# ------------------------------------------------------------------
cd /home/runner/workspace/growpod
PYTHONPATH=src python3 -m gunicorn server:app \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile - &
API_PID=$!

# ------------------------------------------------------------------
# 3. Start the Next.js frontend (port 3000)
# ------------------------------------------------------------------
cd /home/runner/workspace/growpod/web
BACKEND_URL=http://localhost:8000 npm run start &
WEB_PID=$!

# ------------------------------------------------------------------
# 4. Keep the container alive while both services run
# ------------------------------------------------------------------
trap "kill \$API_PID \$WEB_PID; exit 0" INT TERM
wait $API_PID $WEB_PID
