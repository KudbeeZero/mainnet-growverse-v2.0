# Test environment — live tunnel

> Ephemeral. A cloudflared **quick tunnel** (trycloudflare.com) exposing the
> local **web app** so a tester can play in a browser. Quick-tunnel URLs are
> random and **change every restart**.

## One command

```bash
make testenv          # = bash scripts/testenv-up.sh
```

This brings up the whole stack and prints a public `https://<random>.trycloudflare.com`
URL:
1. migrates + seeds the database (idempotent),
2. starts the **API** on `:8000` with `FLASK_DEBUG=false`, `APP_ENV=development`,
   `GROW_TEST_CLOCK=true`, single worker,
3. builds + starts the **web** app on `:3000` with `NEXT_PUBLIC_ENABLE_DEV_BYPASS=true`
   (proxying `/api/*` to the local API),
4. opens the cloudflared tunnel to the web app.

Stop with **Ctrl-C** — the API, web, and tunnel are all torn down.

**Tester flow:** open the public URL → **"Enter as tester → skip login"** → play.
No password or wallet needed. See `docs/TESTER_RUNBOOK.md` for what to test and how
to report bugs.

Prereqs: `make setup` (Python venv), Node/npm (web), and `cloudflared` installed.

## Security posture (intentional for a test env)
- **Flask debug is OFF.** `server.py` defaults `FLASK_DEBUG=false` and the launch
  script forces it off; there is no `.env` committed. **Never expose this app
  publicly with `FLASK_DEBUG=true`** — that enables the Werkzeug debugger (RCE).
- **Writes require the `X-API-Key`** header and are rate-limited; **reads are
  public** by design. Anyone with the URL can hit public reads. The skip-login
  button provisions a throwaway player and stores its key client-side.
- **Dev clock is enabled** (`GROW_TEST_CLOCK=true` on a non-prod `APP_ENV`) so
  testers can fast-forward grows via `/api/dev/clock/*`; these endpoints are
  hard-disabled in production.
- **The skip-login shortcut is build-gated** by `NEXT_PUBLIC_ENABLE_DEV_BYPASS`
  (default OFF) — it never appears in a production build.
- This uses a production web build + the Flask dev server (single worker) — test
  only, not a production WSGI deployment.

## API-only tunnel (optional)
To expose just the API (e.g. for raw endpoint testing), tunnel `:8000` directly:
```bash
FLASK_DEBUG=false APP_ENV=development GROW_TEST_CLOCK=true PYTHONPATH=src \
  .venv/bin/python -m gunicorn server:app --bind 0.0.0.0:8000 --workers 1
cloudflared tunnel --url http://localhost:8000 --no-autoupdate
# then: GET <public-url>/health · /api/game/strains · /api/game/economy/health
```
