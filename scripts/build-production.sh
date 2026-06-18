#!/bin/bash
set -e

# Production build script for GrowPod Empire.
# Runs once per deployment before the container starts.

# Resolve paths relative to this script so it works on any host
# (not tied to a specific deploy platform's directory layout).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ------------------------------------------------------------------
# 1. Install Python dependencies
# ------------------------------------------------------------------
cd "$REPO_ROOT/growpod"
pip install -r requirements.txt

# ------------------------------------------------------------------
# 2. Install npm dependencies for the frontend
# ------------------------------------------------------------------
cd "$REPO_ROOT/growpod/web"
npm install

# ------------------------------------------------------------------
# 3. Build the Next.js app for production
# ------------------------------------------------------------------
# BACKEND_URL tells the Next.js rewrites where to proxy API calls.
# At deploy time the backend runs on the same container at localhost:8000.
BACKEND_URL=http://localhost:8000 npm run build
