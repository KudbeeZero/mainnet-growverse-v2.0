#!/usr/bin/env bash
#
# testenv-up.sh — stand up a safe, public test environment for a human tester.
#
# Brings up the full stack and exposes the WEB app (not just the API) through an
# ephemeral cloudflared quick-tunnel, so a tester can play the game in a browser
# (incl. the "Enter as tester → skip login" shortcut). Safe-by-construction:
#   * FLASK_DEBUG is forced OFF (no Werkzeug debugger / RCE over a public URL).
#   * APP_ENV=development + GROW_TEST_CLOCK=true so testers can fast-forward grows
#     via the dev clock (these endpoints are hard-disabled in production).
#   * NEXT_PUBLIC_ENABLE_DEV_BYPASS=true so the onboarding skip-login button shows
#     (the flag defaults OFF, so production builds never show it).
#   * One API worker so the in-memory dev clock + rate limiter stay consistent.
#
# Writes still require an X-API-Key; reads are public (by design for a test env).
#
# Usage:   bash scripts/testenv-up.sh
# Stop:    Ctrl-C (tears down the API, web, and tunnel).
#
# Prereqs: make setup already run (.venv present); Node/npm for the web; and
# `cloudflared` installed (https://developers.cloudflare.com/cloudflared/).

set -euo pipefail
cd "$(dirname "$0")/.."   # repo: growpod/

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
PY=".venv/bin/python"

command -v cloudflared >/dev/null 2>&1 || {
  echo "ERROR: cloudflared not found. Install it first:"
  echo "  https://developers.cloudflare.com/cloudflared/get-started/installation/"
  exit 1
}
[ -x "$PY" ] || { echo "ERROR: .venv missing — run 'make setup' first."; exit 1; }

PIDS=()
cleanup() {
  echo ""
  echo "Tearing down test environment…"
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# --- 1) Database: migrate + seed (idempotent) -------------------------------
echo "==> Migrating + seeding the database…"
PYTHONPATH=src "$PY" -m alembic upgrade head
PYTHONPATH=src "$PY" -m growpodempire.db.seed

# --- 2) API server (debug OFF, dev clock ON, single worker) -----------------
echo "==> Starting API on :$API_PORT (FLASK_DEBUG=false, GROW_TEST_CLOCK=true)…"
FLASK_DEBUG=false \
APP_ENV=development \
GROW_TEST_CLOCK=true \
PYTHONPATH=src \
  "$PY" -m gunicorn server:app --bind "0.0.0.0:$API_PORT" --workers 1 --timeout 60 &
PIDS+=("$!")

# Wait for the API to answer /health before bringing up the web.
echo -n "    waiting for the API to be healthy"
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
    echo " — ok"; break
  fi
  echo -n "."; sleep 1
done

# --- 3) Web app (skip-login bypass ON, proxying to the local API) -----------
echo "==> Building + starting the web app on :$WEB_PORT (dev bypass ON)…"
(
  cd web
  [ -d node_modules ] || npm install
  NEXT_PUBLIC_ENABLE_DEV_BYPASS=true BACKEND_URL="http://localhost:$API_PORT" npm run build
  NEXT_PUBLIC_ENABLE_DEV_BYPASS=true BACKEND_URL="http://localhost:$API_PORT" \
    npm run start -- -p "$WEB_PORT"
) &
PIDS+=("$!")

echo -n "    waiting for the web server"
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$WEB_PORT" >/dev/null 2>&1; then
    echo " — ok"; break
  fi
  echo -n "."; sleep 1
done

# --- 4) Public tunnel to the WEB app ----------------------------------------
echo "==> Opening cloudflared tunnel to the web app…"
echo "    (the public https://<random>.trycloudflare.com URL prints below)"
echo "    Tester opens that URL → 'Enter as tester → skip login' → play."
echo ""
cloudflared tunnel --url "http://localhost:$WEB_PORT" --no-autoupdate
