# Fleet Sweep — 10-agent hardening audit (2026-06-10)

> A parallel, read-only investigation by 10 independent agents across every problem area, to
> find what we've missed before calling GROWv2 "rock-solid." Each agent checked code against
> claims with `file:line` evidence, ran targeted checks, and produced repro scenarios. This is
> the consolidated record; the carried-risks ledger in `docs/HANDOFF.md` tracks what stays open.

## TL;DR — the narrowed root cause

Three of the four most serious themes are **one underlying defect wearing different hats:**

> **There is no concurrency control on any state-mutating path.** Every spend/harvest/claim/
> catch-up is *check-then-act* with no row locking, and `Wallet.version` is dead code
> (incremented in `ledger.post()` but never wired as SQLAlchemy `version_id_col`). Prod runs
> `gunicorn -w 2`, so two concurrent requests interleave.

That single root cause produces: ledger **double-spend**, **double-harvest** (mints free GROW),
**double-stipend**, **treasury daily-cap overrun** (real-money boundary), and **duplicate
PlantEvents** from the read path. The idempotency gap (carried risk #3) is the same defect from
the client-retry angle. **Fix = row locks (`with_for_update`) and/or idempotency-keyed unique
constraints on the money paths.**

The other launch-blocking theme is **chain settlement is not real** (carried risk #4): the
deposit path trusts no on-chain proof. And a force-multiplier theme: **dev/test SQLite didn't
match prod Postgres**, so a whole class of bug shipped green (partially fixed this session).

**Reassuringly solid (verified, not assumed):** authentication & authorization — **no IDOR**,
every mutation `@require_player` + per-player ownership re-check; the **AI SpendGuard** can't be
escaped and **CI can never hit a live key**; the ledger is correct *single-threaded* (double-entry,
Decimal-clean, property-tested); **no model↔migration drift** (verified against a live Postgres);
the historical **"401 auth race" does not reproduce**; `NEXT_PUBLIC_API_BASE` fallback is robust.

---

## Severity roll-up

| # | Finding | Area | Sev | Theme |
|---|---------|------|-----|-------|
| ECON/C2 | Ledger spend is check-then-act, no lock; `Wallet.version` never wired | economy/concurrency | HIGH | concurrency |
| C1 | `/state` read path double-runs `catch_up` → duplicate PlantEvents | concurrency/sim | HIGH | concurrency |
| C3 | Double-harvest mints GROW; double-stipend; treasury cap overrun | concurrency | HIGH | concurrency |
| ECON-2/#3 | No idempotency keys; settlement retry double-debits + double-transfers | economy | HIGH | concurrency |
| CHAIN-1 | Deposit credits GROW with no on-chain proof (treasury→treasury no-op) | chain | HIGH | settlement |
| CHAIN-2 | No txid replay protection (`onchain_txid` not unique) | chain | HIGH | settlement |
| CHAIN-3 | No DB↔chain reconciliation; `indexer_url` is dead config | chain | MED | settlement |
| C4/AUTH-3 | Rate limiter is per-process `memory://` → limits ×2 across workers | ops | HIGH | single-proc |
| C6/D-01 | SQLite no FK enforce / no busy_timeout/WAL vs Postgres | db/ops | HIGH | parity ✅fixed |
| D-02/F6 | Tests build schema from models, not migrations → future drift invisible | db/ci | HIGH | parity |
| F1/W5 | Web e2e + vitest stubbed to `echo`, not in CI, not in devDeps (phantom) | tests | HIGH | blind-spot |
| F4 | Money/chain HTTP endpoints (`game_api.py` 40%): no auth/IDOR/validation tests | tests | HIGH | blind-spot |
| F2/F3 | Treasury daily-cap + chain-failure rollback paths untested | tests | HIGH | blind-spot |
| SIM-1 | Dormancy shifts `stage_entered_at` → can delay/skip an earned harvest | sim | HIGH* | my-code |
| W1 | No global 401/403 handler → stale key = "logged in" to broken app | web | HIGH | auth-ux |
| SIM-2 | Dormancy skips lethal decay (protective asymmetry) | sim | MED | my-code |
| F5 | Rate-limit test depends on un-reset global state → order-flaky | tests | MED | flaky |
| CHAIN-4 | `link_wallet` accepts any string; no opt-in/ownership check | chain | MED | settlement |
| CHAIN-5 | Note field unused — don't trust notes for deposit identity (design trap) | chain | MED | settlement |
| AUTH-1 | Duplicate email → 500 not 400 | auth | MED | validation |
| AUTH-2 | Username accepted unvalidated (whitespace-only) | auth | MED | validation |
| C5 | Mock chain is a per-process singleton → diverges across workers | ops | MED | single-proc |
| W2/W3/W7 | Strain-map rebuilt per render; countdown clock-skew; no poll backoff | web | MED/LOW | web |
| F1(API)/AI-01 | `set_environment` + auto-care `budget` non-numeric → 500 not 400 | api/ai | LOW | validation |
| AUTH-5/F3(api) | `get_level` public (existence oracle); `email` on broad payloads | api | LOW | info |
| D-04 | 8 Postgres-only `server_default`s a fresh dev DB lacks | db | LOW | parity |

\*SIM-1 is HIGH-impact but currently masked by the default 1-year cap; it bites only if the
`max_catchup_hours` knob is lowered below a stage duration.

---

## Per-area detail (evidence + repro)

### Concurrency / economy (the root cause)
- **C2 / ECON-1 — ledger double-spend.** `economy/ledger.py:61-71` reads `cached_balance`, checks
  `>= 0`, writes — no lock. `Wallet.version` (`db/models.py:76`) is incremented but **no
  `__mapper_args__ = {"version_id_col": version}`**, so optimistic locking never fires. There is
  no DB `CHECK(cached_balance >= 0)`. *Repro:* balance = 1×seed; fire 2 simultaneous
  `POST /seeds/buy` → both pass the check, two seeds delivered, ledger sums negative. Wide open on
  Postgres READ COMMITTED. Same vector: feed, research/unlock, shop/buy, breed, bid.
- **C1 — duplicate PlantEvents from reads.** `services/simulation_service.py:41-45` does a plain
  `session.get(Plant, …)` then `catch_up`. Two concurrent `GET /state` both replay the same hours
  and both insert `stage_change`/`condition_onset`/`death`/`dormancy` rows. The hottest endpoint
  mutates DB state with no guard.
- **C3 — double-harvest / stipend / cap.** `game_service.py:765-796` (harvest checks then sets
  `harvested`), `progression_service.py:34-58` (stipend), `settlement_service.py:54-98` (rolling-24h
  withdrawal cap) are all check-then-act with no lock/unique-constraint. Concurrent dup POSTs mint
  free GROW or overrun the treasury cap.
- **ECON-2 / risk #3 — idempotency.** No mutation accepts an idempotency key. Worst case:
  `settlement.withdraw` debits then `transfer_asset`; a lost HTTP response on retry double-debits
  *and* double-transfers on-chain. `api/game_api.py` mutation routes; `settlement_service.py:82-114`.
- Fix shape: `with_for_update()` on the wallet/plant row in `post()`/`catch_up`/harvest; OR wire
  `version_id_col`; PLUS an `Idempotency-Key` header persisted with a unique constraint; PLUS DB
  unique constraints for one-shot grants (stipend per day, achievement per key, harvest per plant).

### Chain settlement (not launch-ready — carried risk #4)
- **CHAIN-1 (HIGH).** `settlement_service.py:116-140` `deposit()` gates on DB `wallet.asa_balance`
  and does a **treasury→treasury** transfer (no-op on real chain), then credits GROW. *Abuse:*
  withdraw real ASA → move off-platform → re-deposit (DB still says you have the balance) → keep
  both. Treasury drains undetectably once ASA has value.
- **CHAIN-2 (HIGH).** `db/models.py:92` `onchain_txid` has no unique constraint → even a verified
  deposit txid could be replayed N times.
- **CHAIN-3/4/5 (MED).** No reconciliation (`indexer_url` `config.py:90` is dead); `link_wallet`
  (`game_service.py:123-129`) accepts any string with no checksum/opt-in/ownership proof; the txn
  `note` field is unused — the future deposit-verify must take identity from the **verified sender
  address**, never a spoofable note.
- *Positive:* DB-authoritative invariant holds in mint/gameplay (`minting_service.py:54-128`).

### Simulation (the dormancy code shipped earlier today)
- **SIM-1 (HIGH, masked).** `engine.py:285-294` advances `stage_entered_at` by the full skipped
  span, erasing in-stage progress; a stage longer than the cap window never accrues enough time.
  Harmless at the default `max_catchup_hours=8760` (a lifecycle finishes in one window), but the
  knob is documented as a *performance* tuning surface while being **gameplay-correctness
  load-bearing.** *Repro:* `max_catchup_hours=240`, plant in flowering, read 100 days later → stuck
  in flowering vs. reaching harvest under an uncapped cfg.
- **SIM-2 (MED).** Dormancy skips the skipped span's pest/disease/health decay, so a plant that
  would have died survives — a uniformly *protective* asymmetry that should be an explicit rule.
- Fix: leave `stage_entered_at` untouched (advance only `last_tick_at`), OR project stage/decay
  through the skip; and **guard the knob: `max_catchup_hours` must exceed the longest stage.**
- *Solid:* determinism, one-read convergence, death-vs-dormancy ordering, sub-hour reads, boundary
  at exactly the cap — all verified.

### Ops / single-process assumptions (prod is `-w 2`)
- **C4/AUTH-3 (HIGH).** Rate limiter `memory://` per process; `render.yaml`/`.replit` never set
  `RATELIMIT_STORAGE_URI` → every cap (create-account 30/h, advisor 20/m, …) is effectively ×2.
  Config-only fix: provision Redis.
- **C5 (MED).** `chain/factory.py` `_provider` is a process global holding in-memory mock balances;
  with `USE_MOCK_CHAIN=true` in the live deploy, worker A's mint is invisible to worker B.
- **C6/D-01 (HIGH) — FIXED THIS SESSION.** SQLite ran with FK enforcement OFF (vs Postgres ON) and
  no `busy_timeout`/WAL. Added a connect-event listener (`db/session.py`) setting
  `PRAGMA foreign_keys=ON; busy_timeout=5000; journal_mode=WAL`. Suite stays green (185), so no
  latent FK violations exist — and dev/test now actually catch the FK/orphan class.

### Tests / CI blind spots
- **F1/W5 (HIGH) — phantom web tests.** `web/package.json` `test`/`test:e2e` are `echo` stubs;
  `@playwright/test`/`vitest` aren't in devDeps; CI runs only typecheck/lint/build. The whole web
  client has zero CI verification — the "e2e shipped" backlog claim is **another phantom** like the
  integrity gates were.
- **F4 (HIGH).** `game_api.py` is 40% covered; withdraw/deposit/mint have **no** HTTP-level
  auth/IDOR/validation tests — the real attack surface on the money/NFT endpoints.
- **F2/F3 (HIGH).** Treasury daily-cap raise and all `ChainError → FAILED`/rollback branches are
  untested (no fault-injecting provider).
- **F5 (MED) — latent flaky test.** `test_security.py:171` asserts exactly 30/31 creates succeed,
  but the limiter's global `memory://` counter isn't reset between tests; passes only by incidental
  ordering. **Real CI-stability risk.**
- **D-02/F6 (HIGH).** Tests bootstrap via `create_all` (from models), not migrations, and CI checks
  migrations *apply* but not that they *match the models* — future drift ships silently. (A stray
  `alembic/versions/__pycache__/a51c9c36f5a6_drift_probe.pyc` orphan should be cleaned up.)

### Web client
- **W1 (HIGH).** No global 401/403 handler (`web/src/lib/api/client.ts`, `hooks/queries.ts`,
  `RequireAuth.tsx`): a revoked/stale key leaves the user "logged in" to a fully broken dashboard
  with no route back to `/onboarding`. Fix: central `QueryCache.onError` → `logout()` + redirect.
- **W2/W3/W7 (MED/LOW).** `useStrainMap` rebuilds a Map every render (no `useMemo`); countdowns
  tick off `Date.now()` with no server-clock anchor (clock-skew can show closed/open wrongly); no
  retry backoff on a persistently-500ing `/state` poll.

### Auth / API / AI (mostly solid)
- **No IDOR, no missing-auth, no anti-cheat hole** — every mutation `@require_player`, every
  service re-checks ownership; yield/RNG/prices/XP all server-authoritative
  (`tests/test_security.py`). **AI SpendGuard** cannot be escaped; **CI cannot hit a live key**.
- Remaining: **AUTH-1** dup-email → 500; **AUTH-2** username unvalidated; LOW input-validation 500s
  on `set_environment` + auto-care `budget`/`max_actions`; `get_level` is a public existence oracle;
  `email` rides on broader payloads than necessary.

---

## Recommended remediation sequence (each = one audited PR)

1. **Concurrency + idempotency hardening** *(the root cause; supersedes/expands carried risk #3)* —
   `with_for_update()` in `ledger.post()` + harvest + the read-path `catch_up`; wire or remove
   `Wallet.version`; `Idempotency-Key` header + unique constraint; DB unique constraints for
   one-shot grants; concurrency tests (two-session race) + the F5 limiter-reset fixture.
2. **Chain settlement verification** *(carried risk #4)* — txid-verified deposits (confirmed,
   asset-id, receiver=treasury, sender=linked address, amount), txid replay protection
   (unique `onchain_txid`), address validation + opt-in on link/withdraw, a reconciliation job;
   fault-injection tests for the FAILED/rollback paths.
3. **Restore the web safety net** — real vitest + Playwright in devDeps, un-stub the scripts, add a
   `web-test` CI job; add the missing HTTP-boundary tests (F4) + treasury-cap test (F2) + W1 global
   401/403 handler.
4. **Sim dormancy semantics** — pick option (a) and guard `max_catchup_hours > longest stage`
   (decision needed — see SIM-1/SIM-2).
5. **Ops/prod-parity cleanup** — `RATELIMIT_STORAGE_URI=redis` + `healthCheckPath` + graceful
   timeout in deploy config; `alembic check` in CI; the LOW validation-500s + cleanups.

*(This session shipped the C6/D-01 parity fix and these notes; items 1-5 are the batons.)*
