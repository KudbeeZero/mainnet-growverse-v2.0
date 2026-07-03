# Database Systems + Process Audit — GROWv2 (`mainnet-growverse-v2.0`)

> **⚠️ HISTORICAL (2026-06-18)** — frozen evidence audit. A companion audit with ERRATUM is at `growpod/docs/DATABASE_SYSTEMS_AUDIT.md`. Both are historical; for current DB state see `growpod/docs/HANDOFF.md`.

> Read-only, evidence-based audit. Baselined against `origin/main`. No schema,
> migration, CI, or production behavior was changed by this document. Conducted
> 2026-06-18 via a 10-role parallel review (database map, migrations, storage,
> concurrency, test coverage, CI/process, safety/secrets, process/coach).

## 1. Executive summary

The **database design is fundamentally sound** and the **team process is unusually
mature**. The risks that matter are concentrated in **infrastructure and
concurrency**, not in the schema itself.

Top items, baselined against current `origin/main`:

1. **CRITICAL — the real CI never runs.** GitHub Actions only executes workflows in
   the repo-root `.github/workflows/`, which on `main` contains only
   `grok.yml` (an assistant). The real gate —
   `growpod/.github/workflows/ci.yml` (lint, memory-integrity, single-head,
   `alembic upgrade head`, pytest + coverage, web typecheck/lint/build) — sits one
   directory too deep and is **dormant**. Nothing is enforced on any PR.
2. **CRITICAL (history) — a mainnet Algorand treasury mnemonic was committed.** It
   has since been **removed from active config on `main`** (the `.replit` file was
   deleted in commit `20e390f`), but it **remains in git history**, so the wallet
   must be **rotated** before the next deploy. Removal from the working tree is not
   sufficient. (This document references the file/path only and never reproduces the
   secret.)
3. **HIGH — cup prize judging can double-pay under concurrency.** `CannabisCup` has
   no optimistic-lock version and prize payouts credit *different* wallets, so the
   wallet `version_id_col` does not serialize two concurrent `judge()` runs.
   SQLite write-serialization masks this; there are no Postgres concurrency tests.
4. **RESOLVED on `main` (was reported CRITICAL) — Alembic two-heads fork.** A
   duplicate merge revision (`502de4114faa`) was removed in `20e390f`; `main` now
   has a **single head** (`fd1100254612`). No fix PR is required. See §3.
5. **HIGH — `main`'s suite is currently below its own gate** (coverage ~73% < 79%
   floor) and this is unenforced because CI is dormant. The open **economy PR (#10)**
   restores coverage to ~80.3%. The one failing test is a **known pre-existing flaky
   simulation test**, not a DB defect.
6. **MED — migrations are never exercised by the test suite.** The test schema is
   built from ORM metadata (`init_db()` / `create_all`), not from Alembic, so a
   migration that drifts from the models would pass undetected. No Postgres is used
   anywhere in tests/CI, while production is Postgres.

**"Safe enough to build on" is not yet met.** It becomes met once: CI runs at the
repo root, the leaked wallet is rotated, a model↔migration drift check exists, and
the cup-judging concurrency hole is closed. None of these require schema changes.

**Overall recommendation: HOLD FOR FIXES** (CI activation + drift check), with the
**wallet rotation as a P0 safety action** tracked separately.

---

## 2. Database map

This is a **monorepo** (`growpod/` is a nested directory, not a submodule) with two
DB stacks:

| Area | File(s) | Purpose | Risk | Notes |
|---|---|---|---|---|
| Python ORM (authoritative) | `growpod/src/growpodempire/db/models.py` (~30 tables) | Game DB: Player, Wallet, LedgerEntry, Strain, Plant, GrowPod, Harvest, MarketListing, CannabisCup… | low | Well-structured; mixins |
| Constraint naming convention | `db/base.py:15` | Deterministic names for SQLite↔Postgres Alembic parity | low (positive) | Good cross-dialect practice |
| Engine/session | `db/session.py` | Global engine, `session_scope` (commit/rollback), SQLite FK/WAL/busy_timeout pragmas, `reset_engine_for_tests` | low (positive) | `db/session.py:23-38` forces prod-like FK enforcement |
| Config/env | `config.py:26-32` | `DATABASE_URL`; `postgres://`→`postgresql://`; default `sqlite:///growpod.db` | low | Render injects Postgres |
| Alembic (live) | `growpod/alembic/` (21 revisions) | Schema authority; **single head `fd1100254612`** | med | Single-head guard exists (`scripts/check_single_head.py`) |
| Orphan Alembic tree | `src/growpodempire/db/alembic/env.py` (+ README, script.py.mako; empty `versions/`) | Second, unused `env.py` (`alembic.ini script_location = alembic`) | med | Edit-wrong-file risk; dead tree |
| Test DB | `tests/conftest.py:36-44` | Per-test throwaway SQLite via `init_db()` (`create_all`) + seed | med | **Bypasses migrations** |
| Seed | `db/seed.py`, `data/strains.yaml`, `data/balance.yaml` | Idempotent strain upsert by slug | low | Safe Render post-migrate hook |
| Drizzle (TS, additive) | `lib/db/src/schema/cloneRoom.ts`, `lib/db/migrations/0000_clone_room.sql` | "Clone Room" — 3 Postgres tables | low–med | Postgres-only; uncoordinated with Alembic |
| TS DB consumers | `artifacts/api-server/src/services/**` | Direct Drizzle queries, no abstraction | med | No integration tests |
| Duplicate TS stack | `growpod/lib/db/*`, `growpod/artifacts/api-server/*` | Stale divergent copies (no migrations/services) | high | Edit-wrong-copy risk |
| **Active CI** | `.github/workflows/grok.yml` | "Ask Grok" only — no DB, no tests | high | The only workflow GitHub runs |
| **Dormant CI** | `growpod/.github/workflows/ci.yml` | Real gate (alembic, pytest+cov, single-head, web) | high | Wrong path → never runs |
| Prod DB | `growpod/render.yaml` | Render Postgres; `preDeployCommand: alembic upgrade head && seed` | med | Now valid (single head) |

**No `MemStorage`/`DbStorage`/`IStorage` storage-adapter pattern exists** (0 grep
matches), and there are **no loot-box / vault / `already_opened`** concepts — those
audit-template hints do not map to this repo. Storage is plain SQLAlchemy (Python,
authoritative) and plain Drizzle (TS). The only swappable-adapter pattern is the
chain/AI **providers** (ABC + Mock + real), which do not persist state — so there is
no in-memory storage twin to drift.

---

## 3. Migration review

`growpod/alembic/` — **21 revisions on `main`, single head `fd1100254612`**, all with
`downgrade()`. Linear chain with two legitimate fork/merge points.

- **Two-heads fork — RESOLVED on `main`.** Earlier the tail forked into two duplicate
  no-op merge revisions, both with parents `('a7b8c9d0e1f2', 'c8d9e0f1a2b3')`:
  `502de4114faa` (added by `9d44efb`) and `fd1100254612` (added by `92f6de2`).
  Commit `20e390f` removed `502de4114faa`, leaving `fd1100254612` as the sole head.
  The survivor is correct: both were identical empty merges of the same parents, so a
  single head with those parents is the intended graph. **No remediation PR needed;**
  `scripts/check_single_head.py` would now pass.
- **MED — migrations are not tested by the suite.** `tests/conftest.py:41` builds the
  schema via `init_db()` → `Base.metadata.create_all()`, not `alembic upgrade`. The
  suite validates the ORM metadata shape, never the migration scripts. The only
  migration exercise is the dormant CI's forward smoke test on SQLite. No downgrade
  test, no model↔head drift (`alembic check`) test, no Postgres run.
- **LOW (positive) — dialect handling is solid.** `env.py:38,52` sets
  `render_as_batch=True`; NOT-NULL/CHECK adds use `batch_alter_table` + `server_default`
  backfills; columns use portable `sa.JSON()`.
- **MED (future scale) — non-`CONCURRENTLY` index creation.** Unique indexes added to
  already-populated tables (`players.api_key` at `a8adc87534d4:25`; `uq_harvests_plant`
  at `f1a2b3c4d5e6:31`) would take heavy locks on Postgres at scale. Negligible now.
- **INFO — orphan Alembic tree** at `src/growpodempire/db/alembic/` is unused
  (`alembic.ini script_location = alembic`). Risk of editing the wrong `env.py`.

Direct answers: a new dev **can** run migrations locally now (single head; URL defaults
to local SQLite); CI **could** run them from scratch once activated; no hard prod
coupling (env-driven URL); old migrations are valid; a future migration-testing path
exists in part (single-head guard + forward smoke test) but lacks drift/downgrade/
Postgres coverage.

---

## 4. Storage adapter parity

Not applicable as posed — there is no dual in-memory/DB adapter. The real drift
vectors are:

- **SQLite (dev/test) vs Postgres (prod)** — actively mitigated by FK/WAL/busy_timeout
  pragmas (`db/session.py:23-38`); residual: type affinity, true row locking,
  serialization failures.
- **ORM metadata vs Alembic chain** — tests bypass migrations, so schema drift is
  uncaught (see §3).
- **TS api-server DB write paths untested** — e.g. the idempotent guarded update in
  `harvestService.ts:128-143` hits real Drizzle but only pure-function tests exist.

---

## 5. Transaction / concurrency review

Model: **one transaction per request** (`session_scope`), **no row locking anywhere**
(0 `with_for_update` / `FOR UPDATE` in `src/`). Safety rests on **optimistic locking on
`Wallet` and `MarketListing`** (`version_id_col`, → HTTP 409 on `StaleDataError`), a
`cached_balance >= 0` CHECK, and unique indexes (`uq_harvests_plant`,
`uq_cup_entries_cup_harvest`, `uq_grant_claims_*`).

| Flow | File:line | Status | Note |
|---|---|---|---|
| Ledger post / purchases / shop / pods / breeding | `ledger.py:40`; `game_service.py` (multiple) | protected | Same-wallet version + CHECK |
| Market buy / auction bid / settle | `game_service.py:1182-1309` | protected | `MarketListing` version |
| Harvest auto-sell | `game_service.py:946-1056` | protected | `uq_harvests_plant` backstop |
| **Cup prize judging** | `cup_service.py:182-229` | **UNPROTECTED (HIGH)** | Version-less cup; payouts to *different* wallets → not serialized → double-pay/inflation |
| NFT mint | `minting_service.py:54-128` | partial (MED) | No wallet write, no unique/version guard → concurrent double-mint risk |
| Daily stipend / sell-harvest / achievements | `progression_service.py:34-91`; `game_service.py:1072-1133` | partial (MED) | Idempotency survives only incidentally via same-wallet version collision (fragile; confusing 409) |
| Treasury daily withdraw cap | `settlement_service.py:54-114` | partial (MED) | `_enforce_daily_cap` sums without lock → concurrent withdrawals can overshoot the cap |
| Pod capacity / max cup entries | `game_service.py:592`; `cup_service.py:138` | low | Count race, non-money |

**All of these are masked by SQLite write-serialization and need real Postgres
concurrency tests.** The clean fix pattern already exists in-repo — the unique
`GrantClaim` row — and should be generalized to stipend/achievement/mint; the cup path
wants a version column on `CannabisCup` or a `FOR UPDATE` on the cup row in `judge()`.

---

## 6. Test coverage review

- **~47/49 Python test files are DB-backed** against real SQLite; only `test_chain.py`
  and `test_genetics.py` are pure. DB tests run **real SQL/transactions**, not mocks.
- **Strong spots (positive):** `test_concurrency.py` and `test_marketplace_concurrency.py`
  drive two real sessions and assert `StaleDataError` / `IntegrityError` / unique-block
  on money paths; `test_properties.py` asserts `balance == recompute_balance` over
  thousands of randomized posts.
- **Gate:** `fail_under = 79` (`pyproject.toml:20`), `source = ["growpodempire"]`, only
  `*/scripts/*` omitted; ~9 `# pragma: no cover`, all defensible (driver hooks/error
  handlers) — **none hiding SQL**.
- **Current `main` state is RED:** coverage ~73% < 79% floor; 1 failing test (the known
  flaky `test_long_idle_read_is_bounded_and_converges`, nondeterministic, ~2/6 on
  pristine main — not a DB issue); 6 documented free-seed skips. The **open economy PR
  (#10)** restores coverage to ~80.3%.
- **Untested:** the Alembic chain, all Postgres-specific behavior, and TS api-server DB
  writes. No formal DB / non-DB lane split.

---

## 7. CI / process review

- Only `grok.yml` runs on GitHub. `growpod/.github/workflows/ci.yml` is a complete,
  correct pipeline that **never executes** (wrong path) → no lint/memory/single-head/
  migration/pytest/coverage/web gating on PRs. **Failure visibility is effectively
  zero**; a break surfaces only at Render deploy.
- **No `services: postgres:16`** anywhere — even when activated, CI would test only
  SQLite (`ci.yml:24` `DATABASE_URL: sqlite:////tmp/ci.db`) while prod ships Postgres.
- The web job would no-op (`web/package.json` `"test"` is an echo) and `npm ci` may fail
  (lockfile pinned to Replit's firewall per `LOCAL_SETUP.md`).
- Docs assert "CI enforces the same contract" (`CLAUDE.md`, `ci.yml:4-6`) — **untrue
  while dormant.** `LOCAL_SETUP.md` migration head IDs are stale relative to the current
  single head.
- Deploy surfaces (Render / Replit / the Cloudflare quick-tunnel in `TESTENV.md`) can be
  mistaken for backend CI — they are unrelated.
- **Required checks / branch protection** are not visible in-tree — **owner must
  confirm** in repo settings.

---

## 8. Safety / secrets review

- **CRITICAL (history) — committed mainnet Algorand treasury mnemonic.** Referenced by
  path only (the former `.replit`); the value is **not** reproduced here. It was removed
  from active config on `main` (`20e390f` deleted `.replit`), but **persists in git
  history** → the wallet must be **rotated** and the host secret store used going
  forward. Do not run any live-key / live-network path.
- **Safe (verified on `main`):** no hardcoded prod DB URL (all localhost/SQLite/
  placeholder); tests cannot hit a non-local DB (`conftest.py` hard-binds per-test
  SQLite and never reads `DATABASE_URL`); no destructive commands (`init_db()` is
  `create_all(checkfirst=True)`; no `DROP`/`TRUNCATE`/`downgrade base` in scripts);
  `DATABASE_URL` unset → safe local SQLite fallback.
- **LOW:** root `.gitignore` lacks `.env` (latent); production start path historically
  used `init_db()` rather than `alembic upgrade head` — confirm `render.yaml`'s
  `alembic upgrade head` is the deploy path of record.

---

## 9. Coach check

**What the team did well**
- Built a genuinely *enforced* process (memory-integrity, single-head, coverage ratchet
  — when CI runs), a carried-risks ledger with `file:line` evidence cleared only when
  test-backed, independent auditors that distrust PR prose, honest one-PR-one-purpose
  history (migration fixes stay migration-only), and real money-path concurrency tests.
- Already self-healed the two-heads fork and removed the leaked secret from active
  config without being asked.

**What the team should stop doing**
- Treating CI as a safety net while it is dormant — the "CI enforces this" claims are
  currently false.
- Calling work "done/green" on locally-run gates when CI never ran on the merged SHA.
- Letting owner decisions accumulate silently in the baton (chain go-live, required
  checks, dormancy knob).

**What the team should do next**
- Activate CI at the repo root; add a model↔migration drift check and a Postgres lane;
  close the cup-judging concurrency hole; rotate the leaked wallet.

**What the owner should decide**
- Chain/economy go-live gate; whether DB CI becomes a required check (only after it runs
  green consistently); approval of the cup-judging concurrency fix (protected economy
  surface).

**Note on the "economy regression":** the `CLONE_ROOM_QA_REPORT` "seed prices = 0 /
stipend" observation is **intentional free-playtest config** (`balance.yaml`
`seeds.base_cost: 0  # FREE for testing`), guarded by auto-reactivating launch skips
(see DECISIONS 2026-06-18) and addressed by the open economy PR. It is **not a DB
regression** and should not be triaged as a defect. Live-economy values remain
separated (launch profile is owner-ratified and gated).

---

## 10. Recommended next PRs (sequenced; do not bundle)

| Priority | PR idea | Why | Risk | Expected tests |
|---|---|---|---|---|
| **P0** | Activate CI at repo root (`working-directory: growpod`) | Nothing is gated today | Med (CI only) | On a throwaway PR, `backend`/`web` checks appear; merge only once green |
| **P1** | Build test schema from migrations + add `alembic check` (model↔head drift) | Migrations wholly untested; drift invisible | Low (test-only) | Drift check fails on an intentional model edit; suite passes on migration-built schema |
| **P1** | Add a `services: postgres:16` lane to CI | Prod engine + true locking untested | Med (CI only) | Money/concurrency suite passes on Postgres |
| **P2** | Cup-judging concurrency guard (version / `FOR UPDATE`) + test | HIGH double-pay hole | Med (protected economy — owner approval) | Postgres test proves no double-payout under concurrency |
| **P2** | Generalize idempotency (GrantClaim-style unique rows) for stipend/achievement/mint | Fragile incidental protection | Med (protected economy — owner approval) | Postgres concurrency tests for double-claim/double-mint |

**Out-of-band P0 safety action (not a code PR):** rotate the Algorand admin/treasury
wallet and confirm host-secret-store usage before the next deploy (history exposure).

---

## Appendix A — DB migration runbook (recommended; to be ratified)

A dedicated DB runbook does not yet exist (the only `RUNBOOK.md` is strain-research).
Recommended minimum contents for a future `docs/DB_RUNBOOK.md`:

1. **Before authoring a migration:** `python scripts/check_single_head.py`; if multiple
   heads, `alembic merge -m "merge heads" <head1> <head2>` and commit the merge alone
   (migration-only PR).
2. **Authoring:** autogenerate, then hand-review; use `batch_alter_table` for
   NOT-NULL/CHECK adds with `server_default`; add indexes `CONCURRENTLY` on large
   Postgres tables; always implement `downgrade()`.
3. **Local apply:** defaults to local SQLite; `alembic upgrade head` then run the suite.
4. **CI (once activated):** single-head check → `alembic upgrade head` on SQLite **and**
   Postgres → pytest + coverage → `alembic check` (model↔head drift).
5. **Deploy:** Render `preDeployCommand: alembic upgrade head && python -m
   growpodempire.db.seed` is the path of record; the dev `init_db()` convenience must
   not be the deploy path.
6. **Reconcile the orphan Alembic tree** (`src/growpodempire/db/alembic/`) — delete or
   document it so only `growpod/alembic/` is authoritative.

## Appendix B — Database reliability loop (proposed standing process)

Every future DB PR should prove, before merge:
1. **Migration health** — single head; `alembic upgrade head` green on SQLite + Postgres.
2. **Model/schema drift status** — `alembic check` clean (or an intentional, reviewed
   migration accompanies the model change).
3. **SQL-backed test coverage where fidelity matters** — money/concurrency paths tested
   against Postgres, not just SQLite.
4. **CI visibility** — required checks green on the actual merged SHA.
5. **Owner decision** — recorded for any protected-surface change (economy, migrations,
   feature flags, wallet/auth).
