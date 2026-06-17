# STEP 4 — End-to-End Grow Loop Validation Report

**Directive:** BE-004 · **Lead:** BE-A00 · **Date:** 2026-06-14
**Branch:** `claude/simulation-test-clock-u4ounm` (extends PR #47) · **Type:** test-only additions
**Depends on:** STEP 3 Simulation Test Clock (PR #47) — audited **PASS** (`docs/audits/PR-47-simulation-test-clock.md`).

## Asked
Build and validate the complete grow loop end-to-end — **seed → plant → grow → flower → harvest → sell** — driven through the public HTTP API and fast-forwarded with the STEP 3 dev clock, plus HTTP-boundary coverage for the value-bearing routes (RISK #8), without modifying the economy or any production behaviour.

## Done
Two **test-only** files (no source changes):

- **`tests/test_e2e_grow_loop.py` (3 tests)** — the full loop over the wire, fast-forwarded with `POST /api/dev/clock/advance`:
  - `test_full_grow_loop_seed_to_sale` — buy seed → build pod → plant (asserts `seed` stage) → set climate + water/feed and advance the clock until **flowering** → **harvest** (server-side yield, `sold=False`) → **sell** to the NPC market. Asserts the in-game balance rises by **exactly** the `harvest_sale` ledger entry.
  - `test_harvest_cannot_be_sold_twice` — a sold harvest can't be re-sold (no double faucet).
  - `test_growth_advance_posts_no_ledger_entries` — **BE-A08 ledger integrity**: repeated clock advances add **zero** ledger entries.
- **`tests/test_http_boundary.py` (13 tests)** — RISK #8 HTTP-layer coverage for `game_api` value-bearing routes, backed by the offline `MockChainProvider`:
  - **withdraw**: happy path (201, balance debited 500→400, ASA mirror +100), missing/non-positive amount → 400, unlinked wallet → 400, insufficient funds → 400, missing auth → 401/403.
  - **deposit**: round-trips with withdraw (500−200+120=420 in-game, 80 ASA), missing amount → 400, over-ASA → 400.
  - **mint**: harvest happy path (201, `minted`, idempotent re-mint), harvest not-found → 400, strain non-breeder → 400, ARC-3 metadata served after mint + unknown kind → 404.

## Worker results (BE-A01…A10)
| Worker | Assignment | Result |
|---|---|---|
| BE-A01 | Test-clock boot conditions / route registration | ✅ covered (existing `test_test_clock.py` + e2e advance asserts 200) |
| BE-A02 | `/api/dev/clock/advance` | ✅ exercised throughout the e2e loop |
| BE-A03 | `/api/dev/clock/reset` | ✅ covered by existing `test_reset_returns_offset_to_zero` |
| BE-A04 | Seed → Plant e2e | ✅ `test_full_grow_loop_seed_to_sale` |
| BE-A05 | Flower progression via advancement | ✅ care-loop reaches flowering (3-day steps) |
| BE-A06 | Harvest e2e | ✅ harvest (201), server-side yield, `harvested=True` |
| BE-A07 | NPC Sell Market e2e | ✅ sell (200), balance == sale ledger entry |
| BE-A08 | Ledger integrity (no entries from advancement) | ✅ `test_growth_advance_posts_no_ledger_entries` |
| BE-A09 | HTTP-boundary coverage / RISK #8 | ✅ `test_http_boundary.py` (13 tests) |
| BE-A10 | Validation report | ✅ this document |

## Gates (agent-verifiable, re-run this chat)
- `make test` → **262 passed** (was 246; +16), coverage **83.63% ≥ 79** ✅
- `make lint` → pass ✅
- `make check-memory` → OK, 22 files ✅
- Coverage movement: `settlement_service` → 87%, `minting_service` → 73%, the withdraw/deposit/mint/nft `game_api` routes now have HTTP-boundary tests (previously service-layer only).

## Manual validation (device/human — owner)
Per the directive: `GROW_TEST_CLOCK=true APP_ENV=development make serve`, then
`POST /api/dev/clock/advance {"days": 40}`; confirm the plant flowers on the next
`/state` read, harvest + sell succeed, and `/api/dev/clock/*` 404 when the flags
are unset. (Automated equivalents of all four are now in the suite above.)

## Risks
1. **(MED, surfaced by STEP 4) Cure is not fast-forwardable via HTTP.** `GameService`
   — which owns harvest/**cure**/sell and market-listing expiry — defaults to
   `SystemClock`, **not** `active_clock()` (`services/game_service.py:82`). So
   `POST /api/dev/clock/advance` does **not** move cure/expiry time at the HTTP
   boundary. The directive's loop (seed → … → sell) does not need curing, so it is
   excluded from the e2e here. **Recommendation:** a one-line change mirroring STEP 3
   (`self.clock = clock or active_clock()`) would make the *full* canonical loop
   (incl. cure + auction settlement) fast-forwardable. It is production-behaviour
   identical (`active_clock()` returns `SystemClock` whenever the test clock is
   disabled, which is always in prod), but it touches a production-path file, so it
   is **deferred for owner sign-off** rather than slipped into this test-only chat.
2. **(carried) RISK #8 not fully closed.** Backend HTTP boundary is now covered; the
   *web* side (Playwright e2e still a stub; treasury-cap + chain-failure-rollback UI
   tests) remains open — out of scope for this backend/test chat.
3. **Flowering-reach robustness.** The e2e care-loop uses a generous step cap
   (40 × 3 days) and breaks on flowering (~15–18 steps at health). If balance tuning
   ever drastically slows stages, raise the cap; the assertion message names the last
   stage reached.

## Recommendations
- **Merge order:** PR #47 (STEP 3) carries this STEP 4 work on the same branch, so
  the clock and its first real consumer ship together. The clock code is **not yet in
  `main`** — a separate STEP 4 PR based on `main` is not possible without first merging
  #47. Reviewing/merging #47 (now = clock **+** e2e loop) is the cleanest next step.
- **Next:** approve the `GameService` → `active_clock()` one-liner (Risk #1) to unlock
  cure/auction e2e, then proceed to Launch Readiness.

## Observations
- The compute-on-read engine made the e2e trivial to drive: advance the clock, read
  state, repeat — no engine changes, no time mocking inside tests.
- Harvest has no stage gate (yield is computed from health), which the boundary tests
  exploit to build a mint-eligible harvest without a full grow.
