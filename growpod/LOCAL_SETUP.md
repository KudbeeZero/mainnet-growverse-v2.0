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

The earlier two-head fork (`a7b8c9d0e1f2` / `c8d9e0f1a2b3`) has been resolved
with a merge migration (`fd1100254612`); the graph now has a single head,
guarded by `scripts/check_single_head.py` (`make check-migrations`). Local boot
still does not use Alembic: it creates the schema via `init_db()` (ORM
`create_all`), which is what the `.replit` workflow and `seed.py main()` do.

## Frontend (Next.js on :3000)

The `web/` app is standalone (not a pnpm workspace member). Its committed
`package-lock.json` is pinned to Replit's internal package firewall, which is not
reachable outside Replit, so installing against the public registry is required.

```bash
cd web
pnpm install --ignore-workspace    # or: npm install, against a reachable registry
pnpm dev                           # next dev -p 3000
```

That's the whole setup — **no `.env.local` is needed**, and deliberately so.
With `NEXT_PUBLIC_API_BASE` unset, the client uses relative URLs and
`next.config.mjs` proxies `/api/*` and `/health` to `BACKEND_URL` (default
`http://localhost:8000`, which matches the gunicorn backend above). The browser
talks only to `:3000`, so there is no cross-origin/CORS surface and **no API
port is baked into the build** — nothing to drift out of sync.

Open http://localhost:3000 — it redirects to `/onboarding` (new player) or
`/dashboard`.

> **Do not** `cp .env.local.example .env.local` for this setup. That example
> sets an absolute `NEXT_PUBLIC_API_BASE=http://localhost:10000` for the
> *other* run mode (`make serve`, which serves on `:10000`). Mixing it with the
> `:8000` gunicorn backend bakes the wrong port into the browser bundle and every
> API call 502s. Pick one mode: either this proxy mode (backend on `:8000`, no
> env file), or `make serve` on `:10000` with `NEXT_PUBLIC_API_BASE=…:10000`.
> If you run the backend on a non-default port, set `BACKEND_URL` to match when
> starting `pnpm dev`.
