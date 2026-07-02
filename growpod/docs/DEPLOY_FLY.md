# Deploying the growpod Python API to Fly (`growverse-api`)

The GrowVerse frontend on Vercel (`growverse.dev`) proxies `/api/*` to a backend
via the Next.js rewrite (`BACKEND_URL`). The service that actually serves
`/api/game/*` (login/account, economy, breeding, market) is **this** app — the
Python/Flask game API in `growpod/`. This runbook deploys it as the Fly app
`growverse-api`. (The existing `frontiernext` Fly app is a *different*,
Node/Drizzle plant-minting service and is **not** the login backend.)

## What Gate A created (this commit)
- `Dockerfile` — `python:3.12-slim`, installs `requirements.txt`, runs
  `gunicorn -b 0.0.0.0:8080 -w 2 server:app` (`server:app` = `create_app()`).
- `fly.toml` — app `growverse-api`, region `ord`, health check `GET /health`,
  non-secret env (`PYTHONPATH=src`, `PORT=8080`, `CORS_ALLOWED_ORIGINS`), and a
  `release_command` that runs migrations + seed.
- `.dockerignore` — trims dev cruft / the dev SQLite DB / `web/` / `artifacts/`.

> **STATUS UPDATE (2026-07-02): DEPLOYED.** The Fly app `growverse-api` is live with Postgres
> attached and secrets set (`ELEVENLABS_API_KEY`; `RATELIMIT_ALLOW_MEMORY` temporary until
> Redis). Deploys are AUTOMATIC on merge to `main` via `.github/workflows/deploy-api.yml`
> (`FLY_API_TOKEN` repo secret, set 2026-07-02). The manual gates below are executed history;
> the dual-head migration warning is resolved (single head verified 2026-07-02).

## Ship committed code only (no staking)
The working tree currently has **uncommitted staking changes**. A normal
`fly deploy` from `growpod/` would bake those into the image. `.dockerignore`
canNOT fix this (it can't undo edits to tracked files like `models.py`). So the
deploy MUST run from a clean checkout of the committed `HEAD`.

> **CRITICAL prerequisite (do this first):** the deploy artifacts themselves
> (`growpod/Dockerfile`, `growpod/fly.toml`, `growpod/.dockerignore`) are
> currently **untracked**. A clean worktree at a committed SHA will **not**
> contain them, so `fly deploy` would fail with no Dockerfile. **Commit these
> three files (deploy config only — NOT the staking changes) before deploying**,
> then check out that commit. Verify with `git show <SHA>:growpod/Dockerfile`.

> **Do NOT deploy from `main`.** `main` currently has a **dual-head Alembic
> state** (two leaf revisions), so `alembic upgrade head` in the release_command
> would fail. Deploy only from a **single-head** commit on this branch (the
> documented `20e390f` is single-head).

```sh
# from the repo root, non-destructive — does not touch your working tree:
git worktree add ../growverse-deploy <DEPLOY_SHA>   # a single-head commit that includes the deploy files
cd ../growverse-deploy/growpod
fly deploy --app growverse-api
# when done:
git worktree remove ../growverse-deploy
```

## Required configuration
| Name | Where | Secret? | Notes |
|------|-------|---------|-------|
| `DATABASE_URL` | Fly secret | **yes** | Set automatically by `fly postgres attach`. `config.py` normalizes `postgres://`→`postgresql://`. |
| `PYTHONPATH=src` | `fly.toml [env]` | no | src-layout import path. |
| `PORT=8080` | `fly.toml [env]` | no | gunicorn bind port / `internal_port`. |
| `CORS_ALLOWED_ORIGINS` | `fly.toml [env]` | no | `https://growverse.dev`. |

Optional (app falls back to mocks; **not needed for login**): `ANTHROPIC_API_KEY`,
`ELEVENLABS_API_KEY`, `ALGOD_URL`/`ALGOD_TOKEN`/`ALGO_TREASURY_MNEMONIC`/
`WALLET_ENCRYPTION_KEY`, `RATELIMIT_STORAGE_URI` (Redis for multi-worker limits).

## Migration safety (pre-flight verified 2026-06-19)
- Single Alembic head; `alembic upgrade head` applies cleanly on a fresh DB.
- Drift is limited to 4 store tables (`bundles`, `featured_items`,
  `player_badges`, `store_partners`) not created by migrations. The
  `release_command` runs `python -m growpodempire.db.seed`, whose `main()` calls
  `init_db()` (`create_all`) before seeding — so the release finishes with the
  full, seeded 30-table schema. **No migration repair needed.** `players`
  (login) is created by migrations regardless.

## Remaining gates (each owner-approved; commands shown, not yet run)
- **Gate B** — `fly apps create growverse-api`
- **Gate C** — `fly postgres create --name growverse-db --region ord` then
  `fly postgres attach growverse-db -a growverse-api` (sets `DATABASE_URL`)
- **Gate D** — only if real AI/chain wanted: `fly secrets set …` (separate lane)
- **Gate E** — `fly deploy` from the clean worktree (runs release_command, boots app).
  **Prerequisite:** `fly secrets list -a growverse-api` must already show `DATABASE_URL`
  (set at Gate C). If it isn't set, the release_command's `alembic upgrade head` runs
  against an ephemeral SQLite on the release machine and the real Postgres stays empty.
- **Gate F** — after `curl -i https://growverse-api.fly.dev/health` → 200, set
  Vercel `BACKEND_URL=https://growverse-api.fly.dev` (project
  `mainnet-growverse-v2-0-api-server`, team `ascend9`, Production) and redeploy.

## Login smoke test (after Gate F)
```sh
curl -i https://growverse.dev/health                         # 200
curl -i -X POST https://growverse.dev/api/game/players \
  -H 'Content-Type: application/json' -d '{"username":"smoketest"}'   # 200/201, not 404
```
Then create an account through the web UI and confirm no 404.

Security smoke tests (Gate F):
```sh
# CORS must NOT echo an arbitrary attacker origin:
curl -i -H 'Origin: http://attacker.example' https://growverse-api.fly.dev/health \
  | grep -i access-control-allow-origin    # expect: no attacker origin echoed
# Dev test-clock must be closed in production (APP_ENV=production):
curl -i https://growverse-api.fly.dev/api/dev/clock   # expect: 404 (blueprint not registered)
```
