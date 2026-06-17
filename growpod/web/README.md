# GROWv2 Web Client

A React + TypeScript (Next.js App Router) client for the GrowPod Empire game API.
Players create an account, buy and plant seeds, watch plants react in real time,
care for them, harvest and sell, breed and stabilize strains, trade on the
marketplace, fulfill contracts, and climb the leaderboards — all against the live
Flask API. The backend is the source of truth; this client never reimplements
game logic.

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** for styling and the condition → visual map
- **TanStack Query** (React Query) for data fetching, caching, and polling
- **Zustand** for the localStorage-backed pod/plant id store
- Plant reactions are pure **CSS/SVG** (no image assets)

## Getting started

1. **Run the backend** (from the repo root) so the API is on `http://localhost:10000`:

   ```bash
   # Option A
   docker compose up
   # Option B
   pip install -r requirements.txt
   export PYTHONPATH=src
   alembic upgrade head && python -m growpodempire.db.seed
   python server.py
   ```

2. **Run the web client:**

   ```bash
   cd web
   cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:10000
   npm install
   npm run dev                        # http://localhost:3000
   ```

3. Open `http://localhost:3000`, create a player (copy the API key — shown once),
   then buy a seed, create a pod, plant it, and watch the plant's state update on
   the dashboard.

## Configuration

| Env var                | Default                 | Purpose                          |
| ---------------------- | ----------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:10000` | Backend host (the client appends `/api/game`). |

## Scripts

- `npm run dev` — dev server on :3000
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (next/core-web-vitals)
- `npm run typecheck` — `tsc --noEmit`

## How it works

- **Auth:** the API key returned once at player creation is stored in
  `localStorage` (`gpe.api_key`) along with the player id; the API client injects
  it as the `X-API-Key` header on every write.
- **Real-time grow:** the backend advances the simulation lazily on read, so the
  dashboard simply polls `GET /players/<id>/plants/<id>/state` (~7s) via React
  Query — polling itself drives the visible state changes. `condition_flags` map
  to animated SVG reactions (drooping, bug overlay, mildew powder, water sheen).
- **Pod/plant discovery:** the client reads `GET /players/<id>/pods` and
  `/plants`, with a localStorage id store as a fallback and an "import by id"
  recovery flow.

## Project layout

```
src/
  app/        # routes: onboarding, dashboard, lab, market, contracts, leaderboards, account
  lib/        # api client + endpoint modules, types, session, id store, condition visuals
  hooks/      # query + mutation hooks (usePlantState polling, useCareActions, …)
  components/ # ui primitives, layout, plant/pod/strain/market/onboarding components
```
