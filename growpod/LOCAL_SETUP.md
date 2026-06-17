# Local setup (verified)

Verified procedure to run GROWv2 locally: Flask API + Next.js web, talking to
each other over SQLite. No external services or API keys required (AI and the
on-chain layer run in offline mock mode).

All paths below are relative to this directory (`growpod/`).

## Backend (Flask API on :8000)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pip install -e .

export DATABASE_URL='sqlite:///growpod.db'
export USE_MOCK_AI=true USE_MOCK_CHAIN=true PYTHONPATH=src

# Create tables from the ORM metadata and seed strains + store data.
# (Local boot uses init_db(), not Alembic — see note below.)
python -c "from growpodempire.db.session import init_db; init_db()"
python -m growpodempire.db.seed

# Serve (matches the .replit "GrowPod API" workflow).
python -m gunicorn server:app --bind 0.0.0.0:8000 --workers 2 --timeout 60
```

Health check:

```bash
curl http://localhost:8000/health      # {"status":"ok"}
curl http://localhost:8000/readiness   # {"database":"ok","status":"ready"}
```

### Note on migrations

`alembic upgrade head` currently fails with **"Multiple head revisions"** — the
migration graph has two heads (`a7b8c9d0e1f2` and `c8d9e0f1a2b3`); the repo even
ships `scripts/check_single_head.py` to guard against this. Local boot does not
use Alembic: it creates the schema via `init_db()` (ORM `create_all`), which is
what the `.replit` workflow and `seed.py main()` do. The fork should be resolved
with a merge migration before relying on Alembic in production.

## Frontend (Next.js on :3000)

The `web/` app is standalone (not a pnpm workspace member). Its committed
`package-lock.json` is pinned to Replit's internal package firewall, which is not
reachable outside Replit, so installing against the public registry is required.

```bash
cd web
cp .env.local.example .env.local   # then set NEXT_PUBLIC_API_BASE (see below)
pnpm install --ignore-workspace    # or: npm install, against a reachable registry
pnpm dev                           # next dev -p 3000
```

`web/.env.local`:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

The browser then calls the API directly at `:8000`; CORS is already allowed for
`http://localhost:3000` (backend default `CORS_ALLOWED_ORIGINS`). Alternatively
leave `NEXT_PUBLIC_API_BASE` empty to use the Next.js rewrite proxy in
`next.config.mjs` (proxies `/api/*` and `/health` to `BACKEND_URL`, default
`http://localhost:8000`), which avoids cross-origin requests entirely.

Open http://localhost:3000 — it redirects to `/onboarding` (new player) or
`/dashboard`.
