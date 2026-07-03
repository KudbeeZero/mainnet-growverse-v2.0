# Build Log

> **⚠️ FROZEN** — shipping record through the overnight build session (~PR #50). Subsequent work is in git log and PR descriptions; current live state is in `docs/HANDOFF.md`.

Chronological record of what shipped on the trunk (`main`). Newest at the bottom of each section.

> Day-to-day status, priorities and the daily LUT round-table reports live in `docs/memory/`
> (start at `CLAUDE.md` → `docs/memory/README.md`). This file stays a flat shipping log.

## Phases (foundation)
- **Phase 1** — Persistent DB, ledger economy, strain genetics & crossbreeding.
- **Phase 2** — Real-time grow simulation engine (reactions, health, events).
- **Phase 3** — Algorand on-chain layer (ASA token + ARC-3 NFT minting).

## Overnight build session
Each entry: branch · what shipped · test count after merge.

- `docs/roadmap` · 90-day roadmap (`docs/ROADMAP.md`) + this build log · 79 tests.
- `feature/daily-stipend-quests` (merged) · daily login stipend + achievement rewards · 81 tests.
- `feature/player-leveling` (merged) · XP/levels awarded on harvest/breed/mint · 81 tests.
- `feature/api-key-auth` (merged) · per-player API-key auth on all write endpoints · 84 tests.
- `feature/error-handling-validation` (merged) · uniform JSON error envelope + 1 MiB body cap · 87 tests.
- `feature/health-observability` (merged) · /health + /readiness probes, request-id access logs · 90 tests.
- `feature/ci-github-actions` (merged) · CI: lint + migrations + seed + pytest on push/PR · 90 tests.
- `feature/dockerize` (merged) · Dockerfile + compose (Postgres) + gunicorn server · 90 tests.
- `feature/openapi-docs` (merged) · /openapi.json + Swagger UI at /docs · 92 tests.

### Wave 1 (production hardening) complete: auth, errors, health, CI, docker, OpenAPI.
- `feature/strain-search-favorites` (merged) · strain search/filter + favorites · 95 tests.
- `feature/leaderboards` (merged) · richest/breeders/harvests/level rankings · 97 tests.
- `feature/weather-events` (merged) · random pod weather feeding the sim · 100 tests.
- `feature/pod-automation` (merged) · pod tiers grant auto-water/feed honored by the sim · 103 tests.
- `feature/strain-stabilization` (merged) · selfing raises stability over generations -> unlocks NFT mint · 106 tests.
- `feature/asa-wallet-settlement` (merged) · GROW withdraw/deposit mirrors ledger <-> ASA · 110 tests.
- `feature/contracts-orders` (merged) · timed NPC delivery contracts for GROW + XP · 114 tests.
- `feature/market-auctions` (merged) · bid-based auctions with refunds + settlement · 117 tests.

### Wave 2 (gameplay depth) complete: search/favorites, leaderboards, auctions, weather, automation, stabilization, ASA settlement, contracts.
- `feature/test-coverage-property` (merged) · randomized ledger/genetics invariants + pricing monotonicity · 123 tests.

### Wave 3 (quality) complete.

## Sprint 3 — Web frontend, client v1
- `claude/growv2-web-client-sprint3-lNgtu` · Next.js 15 (App Router) + TS + Tailwind + React Query
  web client in `web/`: onboarding + one-time api-key capture, grow dashboard polling
  `GET .../plants/<id>/state` with animated `condition_flags` reactions (droop/bugs/mildew/sheen),
  care + environment + weather controls, strain lab (search/filter/favorites/breed/stabilize/mint),
  market (fixed-price + auctions) + contracts + leaderboards + account. Plus two read-only backend
  list endpoints (`GET /players/<id>/pods` and `/plants`) and a path-filtered web CI workflow
  (lint + typecheck + build) · 125 backend tests.

### Sprint 3 complete: full game loop playable in-browser against the live API.

## Maintenance — fixes & housekeeping
- `claude/game-expansion-algo-sdk` · **Fixed a critical auction-bid exploit**: a player
  could re-bid the opening `min_bid` even after the floor rose, undercutting the standing
  high bid (`game_service.place_bid`). Added a regression test.
- Removed the dead **legacy v1 subsystem** (`app.py`, in-memory `models/`, `blockchain/`,
  `growth_tracker.py`, `environmental_monitor.py`, `api/legacy_api.py`, `demo.py`, `cli.py`,
  + their 2 tests) and its `ENABLE_LEGACY_API` plumbing. Dropped the now-unused `numpy`/`pandas`
  deps. Rewrote `README.md` to describe the real GROWv2; deleted stale `API.md`/`IMPLEMENTATION.md`
  (the generated OpenAPI at `/openapi.json` + `/docs` is the source of truth). Centralized the
  version/name string; named the chain `TREASURY` sentinel (and resolved it in the real provider);
  guarded web `localStorage` access.

## Expansion Wave A — curing & terpenes
- `claude/game-expansion-algo-sdk` · **Post-harvest curing**: a deterministic, compute-on-read
  quality model (`simulation/curing.py`). Harvest with `sell=false`, `start_cure` (commit a
  duration), then `finish_cure` for a quality bonus (diminishing returns toward an optimal window;
  over-drying erodes quality). New harvest routes: list, `cure`, `cure/finish`, and `sell` (the
  latter also fixes that `sell=false` harvests were previously unsellable). Tuning in
  `balance.yaml:curing`.
- **Terpene/cannabinoid genetics**: four quantitative terpene traits (myrcene/limonene/
  caryophyllene/pinene) now inherit through the existing breeding engine and are expressed on each
  harvest (scaled by how well the plant was grown). The catalog's qualitative `terpenes` tags seed
  the genome. A strong dominant terpene earns a sale premium (`balance.yaml:harvest_sale.
  terpene_premium_max`). Migration `b3d7c1a9e240` adds the harvest cure/terpene columns.

## AI "Master Grower" advisor (read-only)
- `claude-expansion-algo-sdk` · A greenfield `ai/` package mirroring `chain/`: an `AdvisorProvider`
  ABC + Pydantic `AdvisorReport`, an offline deterministic `MockAdvisorProvider`, a real
  `ClaudeAdvisorProvider` (official `anthropic` SDK, `claude-opus-4-8`, adaptive thinking, structured
  outputs via `messages.parse`), and a factory that picks mock-vs-real off config. `AdvisorService`
  runs the sim catch-up, builds a compact plant-state context (state, genome, environment, recent
  events) and returns diagnosis + care suggestions constrained to the real care actions. New route
  `GET /players/<id>/plants/<pid>/advisor` (rate-limited). With no `ANTHROPIC_API_KEY` (or
  `USE_MOCK_AI=true`) the mock advisor is used, so CI needs no key. Makes the README's long-standing
  "intelligent advisor" claim real.

## Expansion Wave B — research tree, shop, seasons
- `claude/game-expansion-algo-sdk` · **Research tree**: a 15-node, 5-branch (cultivation/horticulture/
  defense/genetics/operations) data-driven tech tree in `balance.yaml`. `ResearchService` gates
  unlocks by GROW cost + player level + prerequisites; `research_effects()` aggregates unlocked-node
  effects into one additive modifier dict consumed by player-scoped logic (harvest yield/quality,
  curing bonus, care/seed/breeding discounts, pod capacity, terpene expression, consumable potency) —
  the pure sim engine is never touched. Routes: `GET /players/<id>/research`,
  `POST .../research/<node>/unlock`.
- **Consumables shop**: GROW-sink boosters (`cal_mag_boost`, `ladybugs`, `neem_oil`, `bloom_booster`,
  `rejuvenation_tonic`) that manipulate a plant's existing sim levels (so they flow through normal
  yield/quality math). Routes: `GET /players/<id>/shop`, `POST .../shop/buy`,
  `POST .../plants/<pid>/apply`. Care-action costs now honour the care-discount research.
- **Seasonal strains**: a `season` column + `events.current_season` gate `buy_seed` (default "all" =
  always available, so nothing changes until LiveOps rotates the season).
- Migration `c7e2f4a16b80` adds `research_progress`, `consumable_inventory`, and `strains.season`.

## AI auto-care (Phase 3b, agentic)
- `claude/game-expansion-algo-sdk` · The Master Grower can now **act**: a new `ai/autocare.py`
  (MockAutoCareProvider rule loop + ClaudeAutoCareProvider using the SDK `@beta_tool` tool runner)
  drives water/feed/treat-pests/treat-disease against a real plant. `AutoCareService` binds those to
  one plant behind a **SpendGuard** (per-invocation GROW budget + action cap, tuned in
  `balance.yaml:auto_care`) — every tool call posts to the ledger via the normal care path, so the
  loop is server-authoritative and can't overspend. New route
  `POST /players/<id>/plants/<pid>/advisor/auto-care` (rate-limited, gated by `ENABLE_AUTO_CARE`,
  default on). CI uses the mock loop (no key).

## Replit launch — onboarding fixes & build log
- `claude/game-build-first-pr-6t18lz` · **Fixed "create account fails" on the live Replit
  deploy**: the web client baked `http://localhost:10000` into the browser bundle whenever
  `NEXT_PUBLIC_API_BASE` was absent at build time (Next inlines `NEXT_PUBLIC_*` at build), so
  the browser POSTed player-creation to its own localhost. The client now defaults to
  **same-origin relative URLs** (proxied to gunicorn by the Next rewrites), correct regardless
  of build-time env. **Fixed the "I have a key" sign-in**, which read the key from empty
  `localStorage` and threw before contacting the server — the typed key is now sent explicitly
  to validate, then the session is stored. Rewrote the stale `replit.md` template with the real
  two-process wiring + "won't connect" gotchas, and added `docs/DEV_BUILD_LOG.md` (sequenced
  milestones from the backlog). Web-only change; backend untouched.

## Plant grow timeline & countdown
- `claude/plant-stage-timeline` · **Made the grow legible.** Added a pure, deterministic
  `engine.stage_forecast(plant, cfg, now)` that reports where a plant is in its 6-stage
  lifecycle and when — at current health — it reaches the next stage and harvest-readiness.
  It mirrors the engine's own transition rule (`base * (1 + (100-health)/200)` hours), so poor
  care visibly stretches the ETA. Exposed via `SimulationService.forecast()` as a `forecast`
  block on `GET .../plants/<id>/state` (absolute ISO instants so a client countdown stays
  accurate between polls). Web: a new `<StageTimeline>` (full, on the plant detail page) and
  `<StageTimelineCompact>` (on dashboard cards) — a 6-stage stepper, current-stage progress bar,
  live "next stage in" + "harvest-ready in" countdowns, a plain-language "what's happening now"
  blurb per stage for newcomers, and precise effective/ideal-duration numbers for experts. +5
  backend tests (191 total, green).

## Session summary
16 feature branches built + merged to trunk (each its own pushed branch for review):
daily-stipend-quests, player-leveling, api-key-auth, error-handling-validation,
health-observability, ci-github-actions, dockerize, openapi-docs,
strain-search-favorites, leaderboards, market-auctions, weather-events,
pod-automation, strain-stabilization, asa-wallet-settlement, contracts-orders,
plus test-coverage-property. Tests: 79 -> 123, all green. No broken merges.
