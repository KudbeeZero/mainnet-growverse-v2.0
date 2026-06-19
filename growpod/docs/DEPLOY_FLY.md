# Deploying the FRONTIER backend to Fly.io

This is the runbook for deploying the **GROWv2 / `growpodempire` Flask API** to
Fly.io as app **`frontiernext`** in region **`ord`**.

## Architecture (read this first)

- **Public game UI** → Next.js app in `web/`, served via Cloudflare Pages at
  **https://frontierprotocol.app**. This is what players visit.
- **Backend API** → this Flask app (gunicorn `server:app`). It is **API-only**
  (its `/` returns a JSON banner, not the game). It should live behind
  **https://api.frontierprotocol.app** — do **not** point players directly at it.

The frontend calls the API through the existing env var `NEXT_PUBLIC_API_BASE`
(see `web/.env.local.example`). In production set:

```
NEXT_PUBLIC_API_BASE=https://api.frontierprotocol.app
```

The web client appends `/api/game` itself, so set the base origin only.

## Where to run `flyctl` (this fixes "Could not detect runtime or Dockerfile")

Fly looks for a `Dockerfile` in the directory you run it from. The backend lives
in `growpod/`, but the git repo root is one level up (a pnpm/TS workspace Fly
can't auto-detect). So there are **two** equivalent setups — use whichever
matches where you run Fly:

- **Repo root** (default for `flyctl launch` against the GitHub repo): a
  root-level `Dockerfile` + `fly.toml` build the backend from `growpod/`. Just
  run `fly launch` / `fly deploy` from the repo root.
- **Inside `growpod/`**: `growpod/Dockerfile` + `growpod/fly.toml` build the same
  image with a `growpod/` context. Run Fly after `cd growpod`.

Both produce the identical `frontiernext` image. If you previously hit
"Could not find a Dockerfile, nor detect a runtime…", you were launching from
the repo root before the root-level files existed — that's now fixed.

## What's in this repo for Fly

- `Dockerfile` — Python 3.11-slim, installs `requirements.txt`, runs
  `gunicorn -b 0.0.0.0:$PORT -w 2 server:app` (identical command to `render.yaml`).
  Present at both the repo root and in `growpod/`.
- `fly.toml` — app `frontiernext`, region `ord`, internal port `8080`,
  `/health` check, and a `release_command` that runs migrations + seed. Present
  at both the repo root and in `growpod/`.
- `.dockerignore` — keeps secrets and the frontend/Node tooling out of the image.

## Required secrets & env vars

**Required to run in production:**

- `DATABASE_URL` — Postgres connection string. The `release_command`
  (`alembic upgrade head && python -m growpodempire.db.seed`) needs it, and so
  does the running app. Without it the app falls back to local SQLite, which is
  ephemeral on Fly and **will be lost** on every machine restart — do not run
  production on SQLite.

**Strongly recommended:**

- `CORS_ALLOWED_ORIGINS` — comma-separated browser origins allowed to call the
  API. Set to your live frontend origin(s), e.g.
  `https://frontierprotocol.app` (add `https://game.frontierprotocol.app` if/when
  that host exists). Defaults to `http://localhost:3000`; do **not** use `*`
  (the API uses an `X-API-Key` auth header).
- `RATELIMIT_STORAGE_URI` — set to a Redis URI so rate limits hold across
  workers/instances (default is in-memory, per-process).

**Optional (the app has offline mock fallbacks for all of these):**

- `ANTHROPIC_API_KEY` — real AI "Master Grower" advisor (else a mock advisor).
- `ELEVENLABS_API_KEY` — real TTS narration prewarm.
- Algorand on-chain layer: `ALGOD_URL`, `ALGOD_TOKEN`, `INDEXER_URL`,
  `ALGO_TREASURY_MNEMONIC`, `WALLET_ENCRYPTION_KEY`, `ASA_ID`,
  `NFT_METADATA_BASE_URL`. These are **secrets** (the treasury mnemonic
  especially) — set them only via `fly secrets`, never commit them. Without a
  treasury the app uses an offline mock chain.
- GCS narration storage: `GOOGLE_APPLICATION_CREDENTIALS` / bucket config.

Never set `FLASK_DEBUG=true` on a public URL (Werkzeug debugger = RCE).

## Deploy steps (owner)

> Do not deploy until you're ready — these are the post-merge commands.

1. **Create the app + machines config without deploying:**

   ```bash
   # If fly.toml is already present (it is, after this PR), just validate/launch:
   fly launch --no-deploy --name frontiernext --region ord
   # or a pure build check:
   fly deploy --build-only
   ```

2. **Set secrets** (at minimum DATABASE_URL and CORS):

   ```bash
   fly secrets set DATABASE_URL='postgresql://...' -a frontiernext
   fly secrets set CORS_ALLOWED_ORIGINS='https://frontierprotocol.app' -a frontiernext
   ```

   If you provision a Fly Postgres cluster, attach it (this sets `DATABASE_URL`
   for you):

   ```bash
   fly postgres create --name frontiernext-db --region ord
   fly postgres attach frontiernext-db -a frontiernext
   ```

3. **Deploy** (the `release_command` runs `alembic upgrade head` + seed first):

   ```bash
   fly deploy -a frontiernext
   ```

4. **Add the custom domain + cert:**

   ```bash
   fly certs add api.frontierprotocol.app -a frontiernext
   ```

5. **Create the Cloudflare DNS record Fly requests** (a `CNAME`/`A`/`AAAA`
   pair plus the ACME `CNAME` shown by `fly certs show api.frontierprotocol.app`).
   In Cloudflare, set that record to **DNS-only (grey cloud)** while validating
   the cert.

6. **Point the frontend at the API:** set
   `NEXT_PUBLIC_API_BASE=https://api.frontierprotocol.app` in the Cloudflare
   Pages build env and redeploy the frontend.

## Health checks

- `GET /health` — liveness, no dependencies (used by `fly.toml`).
- `GET /readiness` — readiness, pings the database (returns 503 if the DB is down).

## Notes

- Port: gunicorn binds `0.0.0.0:$PORT`; `fly.toml` sets `PORT=8080` and
  `internal_port = 8080`. The server already binds `0.0.0.0` — no code change.
- The `release_command` mirrors the existing Render `preDeployCommand`. If you'd
  rather run migrations manually, comment out the `[deploy]` block in `fly.toml`
  and run `fly ssh console -C 'alembic upgrade head' -a frontiernext` after the
  first deploy.
- Scale-to-zero (`min_machines_running = 0`) is enabled. Background threads
  (seasonal rollover, audio prewarm) catch up on cold start; raise to `1` if you
  want them always warm.
