# Database Systems + Process Coach Audit — GROWv2 (`growpodempire`)

> **Type:** Read-only, evidence-based audit. **Not** a feature build.
> **Date:** 2026-06-18 · **Scope:** `growpod/` backend (Python/Flask + SQLAlchemy + Alembic).
> **Method:** Static review of schema, migrations, services, tests, CI, and process docs with
> `file:line` evidence. No schema/migration/economy/chain changes were made.
> **Evidence labels:** ✅ Verified · 🟡 Partially verified · ⚪ Not tested · ⛔ Out of scope / N/A.

---

## 1. Executive Summary

**Verdict: APPROVE WITH FOLLOW-UP.** The database system is healthy and safe to build on for the
current **off-chain MVP**. The money paths are protected at the **database** level (not just in app
code) and are exercised by concurrency tests; CI is isolated and safe (SQLite, no network DB);
migrations are single-head and applied in CI before the suite runs.

What is solid:
- Optimistic locking (`version_id_col`) on the two high-contention rows — `Wallet` and
  `MarketListing` — plus `CHECK`/`UNIQUE` constraints as hard DB backstops.
- A single-head Alembic graph (21 revisions, head `fd1100254612`), with a gate script
  (`scripts/check_single_head.py`) and `alembic upgrade head` *defined* in the CI workflow.
- Test DB is always **local SQLite**, isolated per test, with FK enforcement turned on to match prod
  Postgres. Coverage ratchet at `fail_under = 79`, no `# pragma: no cover` hiding DB code.
- Secrets are environment-only; production Postgres is injected by Render and never committed.

What needs follow-up (none block the off-chain MVP):
- **⛔ The CI workflow is not actually wired to run.** `ci.yml` lives at
  `growpod/.github/workflows/ci.yml`, but GitHub Actions only discovers workflows in the
  **repository-root** `.github/workflows/` (which here holds only `grok.yml`). So the lint / memory /
  single-head / `upgrade head` / pytest+coverage gates **do not execute on PRs** — they are only run if
  someone invokes `make` locally. PR #22 shows zero status checks for this reason. **This is the top
  process risk:** every "CI enforces X" guarantee in this audit is currently a *local-only* guarantee.
- **Minting idempotency is app-side only** — no DB guard against a concurrent double-mint.
- **Settlement chain transfer is not transactional with the ledger** — a rolled-back DB tx can leave
  an already-sent (mock) chain transfer. Tied to the carried **RISK #4/7** (no on-chain txid-replay
  guard / address validation). **Real on-chain value must stay OFF until #4/7 is closed.**
- Tests build schema from ORM metadata (`create_all`), so **model↔migration drift is only
  smoke-tested**, not round-tripped.
- A set of **bare foreign-key columns lack single-column indexes** (perf, pre-Phase-2).

**Highest database risk:** double-mint / settlement-vs-ledger divergence once a *real* chain is wired
(currently mock-gated). **Highest process risk:** the gates above are **not enforced by GitHub** because
the CI workflow is nested under `growpod/` instead of the repo root — so model↔migration drift, a
fork, or a failing test can merge unblocked.

---

## 2. Database Map

| Area | File(s) | Purpose | Risk | Notes |
|---|---|---|---|---|
| Engine / session | `src/growpodempire/db/session.py` | Global engine + `sessionmaker`; `session_scope()` tx boundary; SQLite pragmas | LOW | Commit-on-success / rollback-on-error (`:84-96`); FK=ON, WAL, busy_timeout for SQLite (`:23-38`) |
| Config | `src/growpodempire/config.py` | Reads `DATABASE_URL`, defaults to local SQLite; normalises `postgres://`→`postgresql://` | LOW | `:26-27` default `sqlite:///growpod.db` |
| ORM models | `src/growpodempire/db/models.py` | 29 tables; constraints, indexes, optimistic-lock columns | LOW | Source of truth for schema in dev/test |
| Declarative base | `src/growpodempire/db/base.py` | `Base`, common columns/mixins | LOW | — |
| Seed | `src/growpodempire/db/seed.py` | Deterministic strain-catalog seed | LOW | Run in CI pre-deploy and in test fixtures |
| Migrations | `alembic/versions/*.py` (21), `alembic.ini`, `alembic/env.py` | Versioned prod schema | LOW | Single head `fd1100254612`; prod uses these (tests do not) |
| Migration gate | `scripts/check_single_head.py` | Fails if >1 Alembic head | LOW | `make check-migrations`; run in CI before upgrade |
| Ledger / economy | `src/growpodempire/economy/ledger.py` | Append-only, Decimal, double-entry-ish posting | LOW | Balance guard + version bump via wallet |
| Settlement | `src/growpodempire/services/settlement_service.py` | Withdraw/deposit GROW ↔ ASA | **HIGH** | Chain transfer not transactional w/ ledger; RISK #4/7 |
| Minting | `src/growpodempire/services/minting_service.py` | Mint harvest/strain as NFT | 🟡 MED | App-side idempotency only; no DB guard |
| Game service | `src/growpodempire/services/game_service.py` | Buy/seed/harvest/bid/grant flows | LOW | Wraps work in `session_scope()` |
| Test harness | `tests/conftest.py` | Per-test temp SQLite, `init_db()` + seed | LOW | `reset_engine_for_tests` rebinds engine |
| CI | `growpod/.github/workflows/ci.yml` | lint → check_memory → check_single_head → upgrade → pytest+cov | **MED** | Well-formed but **nested under `growpod/` → Actions never runs it** (root has only `grok.yml`); gates are local-only. See §7 |
| Deploy | `render.yaml` | Prod Postgres + pre-deploy `alembic upgrade head` && seed | LOW | Secret injected by Render |
| Dead scaffold | `lib/db/` (Drizzle), root `lib/db/` | Unused TS schema | ⚪ NONE | Not imported by the Python backend |

---

## 3. Migration Review

**Ordering / heads — ✅ Verified.** 21 migrations form a chain from `552ac943a9b7` (initial schema)
to a **single current head `fd1100254612`** (an empty merge resolving an earlier two-head fork). The
single-head invariant is enforced by `scripts/check_single_head.py` (`make check-migrations`) and run
in CI *before* `alembic upgrade head` (`.github/workflows/ci.yml`). Filenames follow
`<hash>_<slug>.py`; slugs are descriptive.

**Build-from-scratch — ✅ Verified.** The initial migration creates the core tables; later migrations
are additive `ADD COLUMN` / `CREATE TABLE`. CI proves `alembic upgrade head` works from an empty DB
each run.

**Idempotency / rollback — ✅ Verified (where it matters).** Branch/merge migrations guard against
re-runs — e.g. `fa3e2b1c9d07` checks `inspector.get_table_names()` before `CREATE TABLE`, and
`c8d9e0f1a2b3` checks column existence before `ADD COLUMN`. Downgrade paths are present on standard
migrations; the final merge is a clean no-op both ways.

**Key security migrations — ✅ Verified.**
- `f1a2b3c4d5e6_concurrency_constraints` → wallet `CHECK(cached_balance >= 0)` + harvest
  `UNIQUE(plant_id)`.
- `c3d4e5f6a7b8_marketlisting_optimistic_lock` → `MarketListing.version` (server_default `'0'`,
  `batch_alter` for SQLite compat).

**Large-table lock risk — ✅ low.** Concurrency migrations use `batch_alter_table` (SQLite rebuild;
Postgres emits direct ALTER). No `ADD NOT NULL` on a large table without a default observed. As tables
grow, future index-adds should use `CREATE INDEX CONCURRENTLY` on Postgres (not yet needed).

**🟡 Gap — migrations are not round-tripped in tests.** Tests build schema via
`init_db()`→`Base.metadata.create_all()` (`db/session.py:72-81`), **not** via migrations. CI smoke-runs
`upgrade head` on an empty DB but never asserts that the migrated schema equals the ORM metadata, nor
exercises `downgrade`. **Model↔migration drift could ship undetected.** (See Next PR #2.)

| Migration | Purpose | Risk | Notes |
|---|---|---|---|
| `552ac943a9b7` initial_game_schema | Core tables (players, wallets, ledger, plants, market_listings, …) | LOW | Root |
| `f1a2b3c4d5e6` concurrency_constraints | Wallet non-neg CHECK + harvest-once UNIQUE | **CRITICAL (good)** | DB-level money safety |
| `c3d4e5f6a7b8` marketlisting_optimistic_lock | `version` on market_listings | **CRITICAL (good)** | Serializes auction bids |
| `c7ecd7523cc8` add_grant_claims | UNIQUE(player_id, grant_type, grant_key) | LOW | Idempotent faucets |
| `fa3e2b1c9d07` lecture_audio + seasonal | Branch/merge; idempotent table creation | MED | Merge point |
| `fd1100254612` merge_* | Resolve fork → single head | LOW | Empty no-op merge |
| _(15 others)_ | Additive feature columns/tables (XP, API key, contracts, cup, university, gear, FTUE, …) | LOW | Standard ADD COLUMN/CREATE TABLE |

---

## 4. Storage Adapter Parity (MemStorage vs DbStorage)

**⛔ Not applicable.** The audit template assumes a dual `MemStorage`/`DbStorage` adapter split. **No
such pattern exists here.** Data access is **direct SQLAlchemy ORM** through a session-per-request
model:

- One `session_scope()` context manager (`db/session.py:84-96`) wraps each unit of work; commit on
  success, rollback on exception, close in `finally`.
- API handlers open a scope and hand the `Session` to a service (e.g. `GameService(s)`); services
  query/mutate ORM objects directly. There is no repository or unit-of-work abstraction layer.
- `sessionmaker(autoflush=False, expire_on_commit=False)` (`:62-69`) — explicit flush control,
  objects usable after commit.

The only Mock-vs-real swap in the system is for **chain/AI providers** (ABCs in `chain/`, `ai/`),
chosen by config — *not* for storage. The DB itself is always real: SQLite in dev/test, Postgres in
prod. Because there is a single storage path, there is **no parity-drift surface** between a fake and
a real store — a structural strength, not a gap.

---

## 5. Transaction / Concurrency Review

Concurrency strategy is **optimistic locking on hot rows + DB constraints as hard backstops**. Tests
in `tests/test_concurrency.py` and `tests/test_marketplace_concurrency.py` drive **two independent
sessions** against the same DB to simulate interleaved requests (the prod deploy runs `gunicorn -w 2`).
These are sequential two-session simulations (not OS-thread races), but they do capture the
read-read-write-write interleaving that matters; SQLite is sufficient because the mechanism (version
stamp + `WHERE version = :old`, plus constraints) is DB-agnostic.

| Flow | Atomicity mechanism | Protection | Test coverage | Evidence |
|---|---|---|---|---|
| Wallet debit/credit | Optimistic `version_id_col` + `CHECK(cached_balance >= 0)` | ✅ Protected | ✅ Verified | `models.py:87,94,96`; `economy/ledger.py`; `tests/test_concurrency.py` |
| Auction first bid | Optimistic `version_id_col` on `MarketListing` | ✅ Protected | ✅ Verified | `models.py:678,680`; `tests/test_marketplace_concurrency.py` |
| Double-harvest | `UNIQUE(plant_id)` on harvests | ✅ Protected | ✅ Verified | `models.py:441`; `tests/test_concurrency.py` |
| One-shot grants | `UNIQUE(player_id, grant_type, grant_key)` + app pre-check | ✅ Protected (DB) | 🟡 No concurrent test | `models.py:216`; `game_service.py` `_claim_grant` |
| Minting (NFT) | App-side `nft_status == MINTED` check only | 🟡 Partial | ⚪ Not tested | `minting_service.py:58-59,85` (no DB guard / no version) |
| Settlement (withdraw/deposit) | Ledger debit + wallet optimistic lock | 🟡 Partial | 🟡 Single-request only | `settlement_service.py` — chain transfer not rolled back with DB tx; RISK #4/7 |
| Seed purchase | Wallet optimistic lock (via ledger) serializes per-player | ✅ Protected | 🟡 Via wallet tests | `game_service.py` buy_seed; SeedInventory itself unlocked |

**Error/return shapes — ✅ consistent.** `GameError` / `InsufficientFundsError` raised at the service
layer and serialized to JSON by blueprint error handlers (not-found → 404, validation/already-done/
insufficient-funds → 400).

**Why the two partials matter.** With a **mock** chain (CI/dev/today) both partials are safe — the
mock is deterministic and idempotent. With a **real** chain they become real exposure: a fast double
mint could create two assets, and a rolled-back withdraw could leave an on-chain transfer outstanding.
This is exactly carried **RISK #4/7** and is the reason real-value settlement is design-gated OFF.

---

## 6. Test Coverage Review

- **Provisioning — ✅ local SQLite, isolated.** `tests/conftest.py` binds the engine to a throwaway
  `tmp_path` SQLite file per test, `init_db()` creates schema from ORM metadata, then seeds the strain
  catalog. `reset_engine_for_tests()` (`db/session.py:98`) prevents cross-test bleed. No network.
- **DB-free vs DB tests.** Most tests take a `db`/`session` fixture; pure engine/genetics/advisor tests
  don't depend on persistence. All run in one lane (no separate `test:server:db`); fixtures decide what
  touches the DB.
- **SQL is really exercised — ✅.** Economy, settlement, minting, concurrency, provenance, e2e grow
  loop, and HTTP-boundary tests run real SQL against SQLite (with FK enforcement on).
- **Coverage gate — ✅.** `pyproject.toml`: `fail_under = 79` (ratchet floor), `omit = ["*/scripts/*"]`
  only. No `# pragma: no cover` hiding `db/`, `economy/`, or service code.
- **Honestly not covered — ⚪:** concurrent mint, concurrent settlement (double-withdraw), concurrent
  grant-claim race, migration round-trip/downgrade, and load/soak on the compute-on-read `/state` path.

---

## 7. CI / Process Review

**⛔ Critical wiring gap — the workflow is well-authored but does not run on GitHub.**
The backend workflow is at **`growpod/.github/workflows/ci.yml`**, nested under the `growpod/`
subdirectory. GitHub Actions only discovers workflow files in the **repository root**
`.github/workflows/`, which in this repo contains only `grok.yml` (a `/grok` comment bot, triggered by
`issue_comment` / `workflow_dispatch` — never by PRs). Confirmed empirically: PR #22 reports
`total_count: 0` status checks. **Therefore every gate below is currently local-only and is not
enforced on pull requests** — a fork, a model↔migration drift, a lint break, or a failing test can
merge without any check turning red.

The workflow *content* itself — were it wired up — is **safe and well-structured:**
1. Ruff lint gate (E9,F63,F7,F82) · 2. `scripts/check_memory.py` (memory-layer integrity) ·
3. `scripts/check_single_head.py` (no migration forks) · 4. `alembic upgrade head` (migrations apply
from scratch) · 5. `pytest -q --cov` (suite + 79% gate). `DATABASE_URL` pinned to `sqlite:////tmp/ci.db`
(`:24`) — no network DB. Web job is a **separate Node lane** (typecheck/lint/build/vitest), no DB.

- **Required checks:** ⛔ none currently run on PRs (see wiring gap). The gates are mandatory *by
  convention* (`make test` etc.) but nothing on GitHub blocks a merge.
- **Migrations in CI:** ✅ defined (`alembic upgrade head`, single-head first) — but only executes if the
  workflow is relocated to the root, or if run locally.
- **Deploy separation:** ✅ no Cloudflare; Render (`render.yaml`) is the only deploy target and runs
  `alembic upgrade head && seed` as a **pre-deploy** step (migrations land before new code goes live).
- **Fix (Next PR #0, highest priority):** move/forward `ci.yml` to the repo-root `.github/workflows/`
  (scoped with `paths: ['growpod/**']` and a `working-directory: growpod` default) so the gates run on
  PRs, then mark the backend job a **required** status check at branch protection.
- **🟡 Also:** add a migration round-trip / model-drift check (Next PR #2).

---

## 8. Safety / Secrets Review

- **DATABASE_URL default classification: ✅ LOCAL/SAFE.** Unset → `sqlite:///growpod.db`
  (`config.py:26-27`); CI pins local SQLite. Normal tests never reach a remote/prod DB.
- **No hardcoded credentials — ✅.** `.env.example` holds empty templates
  (`ALGO_TREASURY_MNEMONIC=`, `ANTHROPIC_API_KEY=`); `config.py` reads from env only; `render.yaml`
  injects prod `DATABASE_URL` via `fromDatabase` (Render-managed, never committed/logged).
- **No destructive test commands — ✅.** `reset_engine_for_tests()` is test-only (conftest). The dev
  clock reset endpoint is double-gated OFF in production (`GROW_TEST_CLOCK` + `APP_ENV != production`)
  and does not touch the DB.
- **Prod separation — ✅.** CI uses ephemeral `/tmp/ci.db`; dev uses git-ignored `growpod.db`; prod
  uses Render's managed `growv2-db` Postgres.
- **🟡 Ongoing:** enable GitHub secret-scanning / periodic `git log` review (already recommended in
  `SECURITY_AUDIT.md`). RISK #11: rate limiter is in-memory per-worker — set
  `RATELIMIT_STORAGE_URI=redis://…` before scaling beyond one instance.

---

## 9. Coach Check

**What the team did well**
- Put the money-safety invariants **in the database** (CHECK/UNIQUE/optimistic locks), then wrote
  concurrency tests that prove them — the right order.
- Enforced a single Alembic head and ran migrations in CI; kept tests network-free and isolated.
- Maintained an honest carried-risks ledger in `docs/HANDOFF.md` and a memory-integrity gate, so
  status claims are checkable rather than vibes.
- Correctly gated real on-chain value OFF while the mock chain carries the MVP.

**What the team should stop doing**
- Trusting "CI" that **does not run.** The single biggest process illusion here is a polished `ci.yml`
  that GitHub never executes because it is nested under `growpod/`. Stop assuming PRs are gated until a
  red/green check actually appears on the PR.
- Relying on `create_all` for tests while prod uses migrations, with **nothing** asserting the two
  agree. Stop treating "CI ran `upgrade head`" as proof the schema matches the models.
- Adding economic flows (mint/settlement) whose only idempotency is an app-side status check — assume
  a race will happen.

**What the team should do next**
- **Relocate `ci.yml` to the repo root so the gates run on PRs**, then require the backend job at
  branch protection. Add the concurrency cases that are currently missing (mint, settlement,
  grant-claim) and a migration round-trip/drift test. Backfill single-column indexes on hot bare FKs
  before Phase-2 sim load.

**What the owner should decide**
- Approve relocating the CI workflow to the root + making the backend job a **required** status check
  (this is the highest-leverage process fix).
- Whether to schedule the **RISK #4/7** hardening (txid-replay guard + address validation +
  reconciliation) now or hold until just before any real-value launch — it is the gate for turning the
  chain on.
- Whether to add FK indexes now (small migration, protected surface) or defer to Phase 2.

---

## 10. Recommended Next PRs

> Proposals only — **not started** in this audit.

| Priority | PR idea | Why | Risk | Expected tests |
|---|---|---|---|---|
| **0** | **Relocate `ci.yml` to repo-root `.github/workflows/`** (scope `paths: ['growpod/**']`, `working-directory: growpod`); make the backend job a required check | The gates don't run on PRs today — CI is defined but never executes | Low (CI config only) | Workflow runs green on the PR that moves it |
| 1 | Concurrency test matrix expansion: concurrent mint, double-withdraw settlement, grant-claim race | Proves existing constraints and surfaces the minting-idempotency gap with evidence | Low (test-only) | New cases in `tests/test_concurrency.py` / `test_marketplace_concurrency.py` |
| 2 | Migration round-trip + drift guard: `upgrade head` from scratch, `downgrade` one step, assert migrated schema == ORM metadata | Tests bypass migrations today, so drift is unguarded | Low (CI/test-only) | Migration smoke test + metadata-diff assert |
| 3 | FK index pass for hot `player_id` / `strain_id` / `pod_id` lookups | Avoid table scans before Phase-2 simulation load | Low–Med (**migration = protected surface; needs owner OK**) | Query plan / migration smoke test |

**Bigger goal (owner-gated):** close **RISK #4/7** — on-chain `txid` replay protection, Algorand
address validation, and deposit reconciliation — **before any real-value / on-chain launch**. Until
then keep settlement on the mock chain (`USE_MOCK_CHAIN=true` / no treasury mnemonic).

---

## Merge / Process Recommendation

**APPROVE WITH FOLLOW-UP.** The DB system is safe to build on for the off-chain MVP: money paths are
DB-protected and tested, CI is isolated and enforces single-head migrations, secrets are env-only. Land
the follow-up PRs above (test matrix, migration drift guard, FK indexes) as small scoped changes, and
keep real on-chain settlement gated OFF until RISK #4/7 is closed.

*This is a read-only audit. No schema, migration, economy, settlement, minting, or chain behavior was
changed. Evidence is cited as `file:line` against the repo state on the audit date.*
