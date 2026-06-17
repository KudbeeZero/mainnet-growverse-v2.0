# Test environment — live tunnel

> Ephemeral. A cloudflared **quick tunnel** (trycloudflare.com) exposing the local
> API for test access. Quick-tunnel URLs are random and **change every restart**.

## Current tunnel (2026-06-10 night-shift)
- **Public URL:** https://returns-genes-protein-prevention.trycloudflare.com
- **Proxies:** local API at `http://localhost:10000` (`server.py`)
- **API base:** `<public-url>/api/game`
- **Try it:**
  - `GET <public-url>/health`
  - `GET <public-url>/api/game/strains`
  - `GET <public-url>/api/game/economy/health`  ← new
  - `GET <public-url>/api/game/strains/<id>/effects`  ← new

## Security posture (intentional for a test env)
- **Flask debug is OFF** and the Werkzeug reloader is OFF — the `.env` sets
  `FLASK_DEBUG=true`, which would expose the debugger (RCE risk) over a public
  URL, so the server was started with `FLASK_DEBUG=false` overriding it. **Do not
  expose this app publicly with `FLASK_DEBUG=true`.**
- **Writes require the `X-API-Key`** header and are rate-limited; **reads are
  public** by design. Anyone with the URL can hit public reads.
- This is the Flask dev server, not a production WSGI server — test only.

## How it was started
```bash
# 1) API server (debug forced off; .env would otherwise turn it on)
FLASK_DEBUG=false PORT=10000 PYTHONPATH=src .venv/bin/python server.py
# 2) cloudflared quick tunnel
cloudflared tunnel --url http://localhost:10000 --no-autoupdate
```

## To stop
Stop the two background tasks (the `server.py` process and the `cloudflared`
process). Because `.env` carries `FLASK_DEBUG=true`, always re-launch the server
with `FLASK_DEBUG=false` before re-opening a tunnel.
