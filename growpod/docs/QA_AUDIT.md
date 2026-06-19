# GrowVerse QA / wiring audit (2026-06-19)

Read-only audit for the frontend-only QA testing lane. Evidence is in the repo at
the cited paths. **No backend, DB, staking, or economy changes were made.**

## QA 10× multiplier (`devSpeedStore`)
- **Store:** `web/src/lib/devSpeedStore.ts` — `devSpeed` bool + `elapsedHours`,
  persisted to localStorage `gpe.devSpeed` (Zustand persist). Survives refresh,
  logout/login, and route navigation.
- **No stacking:** `toggle()` flips `devSpeed` and resets `elapsedHours`; pressing
  again disables it. No double-advance.
- **Badge honesty:** `web/src/components/layout/NavBar.tsx` shows the green `⚡ 10×`
  glow **only when `devSpeed === true`** — honest to store state.
- **What it drives:** the dashboard runs a 700ms loop posting
  `POST /api/dev/clock/advance` then refetching plants (`web/src/app/dashboard/page.tsx`).
- **Production reality (important):** the dev clock is gated **off** in production —
  `config.py` sets `test_clock_enabled = GROW_TEST_CLOCK and not is_production`, and
  the blueprint is only registered when enabled (`flask_api.py`). Our Fly backend
  runs `APP_ENV=production`, so `/api/dev/clock/advance` **404s**. Previously the loop
  swallowed this and kept ticking a fake counter — a **silent no-op**. Fixed this lane
  (see below). True acceleration only works against a non-production backend
  (`APP_ENV` unset/dev **and** `GROW_TEST_CLOCK=true`).
- **Non-test users:** never accelerate unless they toggle the badge, and even then the
  backend ignores it in production. No accidental acceleration.

## System classification
| System | Status | Evidence |
|--------|--------|----------|
| Audio (ElevenLabs/lecture) | **partial — university lectures only** | `api/audio_prewarm.py`, `web/src/app/university/courses/[key]/page.tsx`. NOT wired to general gameplay/notifications. |
| University/education | **wired & working** | `university_service.py`, `/university/*` pages. |
| Staking | **should stay unwired (flag OFF)** | `web/src/lib/features.ts` `staking:false`; backend `staking_service.py` exists but no live UI. Left untouched. |
| Market / sell | **wired & working** (not a no-op) | `web/src/components/market/CreateListingForm.tsx` → `api.market.createListing/createAuction` → real endpoints; buy in `ListingCard`. |
| Lab / genetics | **wired & working** (genbank/microscope read-only views) | `web/src/app/lab/breed/page.tsx` → `api.breeding.breed`. |
| Harvest / reward | **wired & working end-to-end** | `game_api.py` harvest → ledger sale; `CareButtons` harvest. |
| Notifications / milestones | **partial — events exist, no live feed/toasts** | `PlantEvent` model; `recent_events` on `/state`; rendered by `EventLog` **only** on the plant detail page. No toasts on change, no dashboard feed. |

## Changes made this lane (frontend-only)
1. **Honest 10× clock** (`dashboard/page.tsx`): the counter now increments only on a
   real backend advance; if the dev clock is unavailable (404), it stops the boost,
   turns the badge off, and shows a toast — no more silent fake ticking.
2. **QA milestone toasts** (`hooks/useQaMilestones.ts`, wired on the plant detail page):
   when the QA boost is on, toasts fire on real state changes derived from the polled
   `PlantState` — new growth stage, ready-for-harvest, water/nutrient changes, health
   drops, and new condition flags. Off unless the QA boost is active. No fake data.
3. Existing **Event Log** on the plant detail page already provides the activity
   timeline (`EventLog` ← `recent_events`); no duplicate feed added.

## Market / sell feedback
No placeholder added: the sell/list flow is **already wired** to real endpoints and is
not a silent no-op. (If a future flow accepts an action and no-ops, label it honestly
then.)

## Recommended for a later (backend) lane
- A **QA-only compressed milestone schedule** so growth visibly progresses in minutes
  without the dev clock — this needs the server simulation (`simulation/`,
  `SimulationService.sync`) and is intentionally **out of scope** here.
- Optionally expose a safe **QA-gated advance** that works without full prod gating,
  or a read endpoint that fast-forwards a single plant for testers.
