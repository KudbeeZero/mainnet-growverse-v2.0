# Pre-launch error sweep — 2026-06-13 (dual independent + reconciliation)

**Owner ask:** stand by until the other two sessions finish, then run a full error/problem
sweep, have **two** independent passes compare and catch what either missed, double-check the
divergences, run it through the round-table, and square it away — laser-focused on launch
(shipping in a couple days).

**Method.** Two independent sweep agents (A and B) hunted the same brief with no shared context,
so "did anyone miss anything" is a real comparison, not an echo. Objective gates were run once
centrally (test/lint/memory/migrations + the web build). The orchestrator then re-verified every
**divergence** between A and B at file:line before trusting either, and made the ship/no-ship
call per finding.

---

## Launch base is green

Run on `origin/main` (= 48ea3cb, the launch base):

- **Backend:** `make test` → 222 passed, coverage **80.82%** ≥ 79; `ruff` clean; memory integrity
  OK (18 files); Alembic **single head** `f1a2b3c4d5e6`, **zero** model↔migration drift
  (live `compare_metadata`).
- **Web:** `npm ci` clean; `tsc --noEmit` clean; `next lint` clean; `next build` succeeds (18/18
  static pages). (2 moderate npm advisories + a `next lint`→Next 16 deprecation — non-blocking.)
- **The two just-finished sessions' work is regression-free:** PR #19 (`plant-structure-audit`,
  web silhouette system — `clamp`/`lerp` exports verified, `indicaRatio` guarded `?? 0.5` at every
  call site) and PR #20 (`planning-session`, docs + de-flake of 2 tests) both reviewed by diff;
  no source regressions.

---

## Where the two passes DIVERGED (the value of running two)

### 1. Agent A caught a lost-funds race that Agent B missed — CONFIRMED, and FIXED here
**Auction first-bid race — `MarketListing` had no optimistic lock.**
`db/models.py` (MarketListing) had no `version`/`__mapper_args__`, unlike `Wallet`
(models.py:78-90). In `game_service.py:place_bid` (1075-1102), two *first* bids on the same
auction debit two **different** bidder wallets — so the wallet-level optimistic lock (RISK #6
core) can't serialize them. Both write the listing row last-writer-wins; the losing bidder is
debited (`AUCTION_BID`) with **no** standing high-bid and **no** refund path (the refund only
fires for a *subsequent* bid that sees a prior bidder, and it pays the *current* `highest_bidder`,
who is now the winner). Net: stranded funds for the loser. Agent B asserted the market was fully
protected by the wallet lock — true for buy/re-bid (shared wallet collides), **false** for the
first-bid case. Orchestrator confirmed the gap at file:line.

→ **Fixed in this branch** (see below). The fix mirrors the proven wallet pattern, changes no
prices/faucets/sinks, and is covered by a new concurrency test.

### 2. Agent B caught a config fact that flips RISK #7's severity — RECONCILED
Agent A characterized chain settlement (RISK #7) as "mock + TestNet-gated, not a launch concern."
Agent B found `config.py:101-103`: `USE_MOCK_CHAIN` defaults `"false"`, network defaults
`testnet`, `MAX_WITHDRAWAL_PER_DAY` defaults `10000`. Orchestrator verified and went one level
deeper — `chain/factory.py:19`: the real `AlgorandProvider` engages when `use_mock_chain` is
false **AND** a treasury mnemonic is set; with no mnemonic it falls back to the mock.

**Reconciled truth (more precise than either agent):** nothing *forces* the mock once an operator
configures a real treasury (`ALGO_TREASURY_MNEMONIC`) — which is the entire point of the chain
layer — and `USE_MOCK_CHAIN` defaults false. So **the day real on-chain value is turned on,
RISK #7 is live and exploitable.** There is no separate settlement feature-flag guarding the
withdraw/deposit routes beyond that mock/mnemonic coupling.

---

## Launch-blocker triage (round-table verdict)

| Sev | Finding | File:line | Verdict for launch |
|----|---------|-----------|--------------------|
| **BLOCKER (if chain on)** | RISK #7 — `deposit()` credits in-game GROW off the DB-only `asa_balance`; provider transfer is treasury→treasury (no on-chain pull); no txid-replay guard; `link_wallet` does no address validation. withdraw→move-off→re-deposit double-counts the treasury. | `settlement_service.py:116-134`; `models.py:105`; `game_service.py:133-139`; `chain/algorand.py:59,83` | **Owner decision (stop-and-ask class).** Ship with chain OFF (no `ALGO_TREASURY_MNEMONIC`, or `USE_MOCK_CHAIN=true`), OR hard-gate/disable the withdraw+deposit routes, until indexer-verified deposits + a unique `onchain_txid` + `algosdk` address validation are built. **Do NOT enable real value at launch without this.** |
| **HIGH → FIXED** | Auction first-bid lost-funds race (no listing optimistic lock). | `models.py` MarketListing; `game_service.py:1075-1102` | **Fixed in this branch** (version_id_col + migration + test). |
| MED | RISK #9 — sim dormancy skips lethal decay across long absences. Masked at the default cap (8760h). | `simulation/engine.py:358-367` | Not launch-fatal at defaults. Needs a design decision + a knob guard before lowering `max_catchup_hours`. |
| MED | RISK #10 — web has no global 401/403 handler; a stale/revoked key leaves a user "logged in" to a broken dashboard with no re-auth path. | `web/src/lib/api/client.ts:118-124`; `RequireAuth.tsx:9-18` | Not first-run-fatal (new players get fresh keys); bites any key-invalidation. Cheap fix: clear session + redirect on 401/403. Recommend before launch. |
| MED | `main` carries a **flaky** test (`assert 'seed' != 'seed'`) — failed 1/6 isolated runs here. The de-flake exists only on unmerged PR #20. | `tests/test_stage_forecast.py:88`; `tests/test_simulation.py` | **Merge PR #20** to stop `main` CI flapping red. (Independent of any code change.) |
| LOW | `get_level` is a public oracle (any player's XP/level by id). | `api/game_api.py:93-101` | Info leak only; add `@require_player` or accept as public by design. |
| LOW | Rate-limit storage defaults to `memory://` (per-worker; ineffective across gunicorn workers). | `config.py:75` | Config-only: set `RATELIMIT_STORAGE_URI=redis://…` in prod. |
| LOW | `plant_events` public; cup payout is a faucet to watch for sink balance; 2 moderate npm advisories; `next lint` deprecation. | `game_api.py:621`; `cup_service.py:206`; web | Notes, not blockers. |

### Both agents agreed (verified solid — not assumed)
Concurrency core (RISK #6) genuinely landed (`wallets.version` + `version_id_col` + `CHECK >= 0`
+ `uq_harvests_plant`); no float-for-money in the ledger; auth coverage is systematic (every
`<player_id>`-scoped mutation carries `@require_player`; only `get_level` is an ungated read); no
IDOR; market double-entry is correct; withdrawal daily-cap is sound; single migration head, no
drift. The faucet double-claim "remainder" of RISK #6 is **incidentally** safe (concurrent claims
collide on the shared player wallet's lock); the documented NEXT ACTION makes it semantic, not a
money hole.

---

## What this branch changed

`claude/code-review-error-sweep-7h57k6`:
- **Fix:** `MarketListing.version` + `__mapper_args__ = {"version_id_col": version}` (mirrors
  `Wallet`), migration `c3d4e5f6a7b8` (single head; fresh upgrade clean; zero drift).
- **Test:** `tests/test_marketplace_concurrency.py` — two concurrent first bids; the loser hits
  `StaleDataError`, rolls back, is **not** debited; exactly one standing bid remains.
- Gates after the fix: 222 passed (+ the new test = 223 when the unrelated sim flake doesn't trip),
  coverage 80.83%, ruff clean, single head `c3d4e5f6a7b8`, zero drift, memory OK.

## Needs the owner (decisions, not facts)
1. **RISK #7 / chain at launch** — confirm chain ships OFF (or routes gated) until verified
   settlement is built. This is the one true launch gate. (Stop-and-ask per the delegation charter
   — not touched here.)
2. **Merge PR #20** to de-flake `main`'s CI.
3. Optional-but-recommended before launch: the web 401/403 re-auth handler (RISK #10).
