# GROWv2 — GrowPod Empire (Replit deployment notes)

A cannabis-growing game with a persistent ledger economy, real strain genetics, a
real-time grow simulation, an Algorand on-chain asset layer (mocked by default), and an
AI "Master Grower" advisor. Backend is Python/Flask; the web client is Next.js 15 in `web/`.

> Project memory and conventions live in `CLAUDE.md` → `docs/memory/`. This file is just the
> Replit runtime/deploy reference.

## Architecture on Replit (two processes)

```
browser ──▶ Next.js (next start, :3000)  ──/api/* rewrite──▶ gunicorn server:app (:8000)
            relative URLs, same origin        (next.config.mjs)     Flask game API
```

- The **web client uses same-origin relative URLs by default** (see
  `web/src/lib/api/client.ts`). The Next.js rewrites in `web/next.config.mjs` proxy
  `/api/*`, `/health`, and `/openapi.json` to `BACKEND_URL` (the gunicorn backend).
- Because requests are same-origin and proxied server-side, **CORS does not apply** in this
  topology. (CORS only matters if you point `NEXT_PUBLIC_API_BASE` at a separate API domain.)

## Run & operate

Dev "Run" button launches both workflows in parallel (`.replit`):
- **GrowPod API** — `PYTHONPATH=src gunicorn server:app --bind 0.0.0.0:8000 --workers 2 --timeout 60`
- **GrowPod Web** — `cd web && npm run start` (requires a prior `npm run build`)

## Required environment (`.replit` → `[userenv.shared]`)

| Var | Value | Why |
|-----|-------|-----|
| `BACKEND_URL` | `http://localhost:8000` | Next rewrite target (the gunicorn backend) |
| `PYTHONPATH` | `src` | Package import root (mirrors CI) |
| `USE_MOCK_AI` | `true` | No live Claude key needed |
| `USE_MOCK_CHAIN` | `true` | No live Algorand key needed |
| `RATELIMIT_ENABLED` | `true` | Per-IP write rate limiting |
| `NEXT_PUBLIC_API_BASE` | *(empty / unset)* | Empty ⇒ relative URLs. Set to a full URL only if the API lives on a separate domain. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Only relevant if a cross-origin `NEXT_PUBLIC_API_BASE` is used |

## Gotchas (read before debugging "it won't connect")

- **`NEXT_PUBLIC_*` is inlined at *build* time, not run time.** If the web bundle is built
  without the var, that value is baked in permanently. The client now **defaults to relative
  URLs**, so a missing/empty `NEXT_PUBLIC_API_BASE` is safe — it no longer hardcodes
  `localhost:10000`. If you *do* set an absolute base, rebuild after changing it.
- **The autoscale `[deployment]` block has no `run` command — only `postBuild`.** Confirm the
  deployed app actually starts **gunicorn**, not just Next. If only Next runs, every `/api/*`
  call proxies to a dead `:8000` and all writes (incl. account creation) fail with a 502.
- **`POST /api/game/players` is rate-limited to 30/hour.** Repeated debugging attempts can
  return 429 ("create fails") — a red herring, not a real outage. Wait or restart the backend.

## Local development (outside Replit)

- Backend: `make serve` (defaults to `:10000`).
- Web: in `web/.env.local` set `NEXT_PUBLIC_API_BASE=http://localhost:10000` to match
  `make serve`, then `npm run dev`. (Or run gunicorn on `:8000` and leave it relative to use
  the Next rewrite, matching production exactly.)
