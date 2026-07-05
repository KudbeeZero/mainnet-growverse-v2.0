# Infrastructure audit — api/, chain/, db/, services/ plumbing (2026-07-05)

> Read-only software-engineering audit of the non-domain layers: auth/rate-limit/error
> handling, the Algorand chain layer, DB/session/migrations, secrets hygiene, and a
> dead-code/TODO/test-coverage sweep of the non-coaching services. Scope deliberately
> excludes `simulation/`, `genetics/`, the cultivation-coaching `ai/`+`services/` modules,
> `plant/` UI, and strain data files — those are queued for a separate domain-layer pass.
> Every claim below carries `file:line` evidence; drift was verified mechanically, not by
> eyeballing migrations.

**Branch:** `claude/growverse-audit-split-8qrehy` (at `main` = `f711427`) · **Date:** 2026-07-05
**Baseline honored:** PR #104/#137 hardening, PR #144 (withdraw double-payout, mint races),
`e7e289a` (sender_mnemonic hatch, proxy hop-count) are settled — not re-reported.

## TL;DR

The API surface is in genuinely good shape — guard coverage is complete, error handling is
disciplined, secrets hygiene is clean. The two findings that matter most are **(1) the ORM and
alembic have drifted again**: four store/badge tables exist only because boot-time
`create_all` papers over the gap, which will break a future deploy's `release_command`; and
**(2) the settlement layer can fire an implicit, treasury-signed asset-create transaction**
if `ASA_ID` is ever unset with a real provider configured. Both are cheap to fix. A third,
**the chain layer never verifies the node it's talking to matches the configured network** —
the only thing standing between "testnet" config and mainnet transactions is a URL string.

## Severity roll-up

| # | Finding | Area | Sev |
|---|---------|------|-----|
| 1 | 4 ORM tables + 1 type mismatch have no alembic migration (masked by boot `create_all`) | db/migrations | HIGH |
| 2 | `SettlementService.__init__` implicitly creates a real ASA when `ASA_ID` unset | chain/settlement | HIGH |
| 3 | No genesis-ID guard: `ALGORAND_NETWORK` is a label, never checked against the node | chain | MEDIUM |
| 4 | Postgres engine has no `pool_pre_ping`/`pool_recycle` → stale-connection 500s | db | MEDIUM |
| 5 | Contract expiry status write is rolled back by the accompanying raise | services | MEDIUM |
| 6 | `MAX_WITHDRAWAL_PER_DAY=""` silently disables the treasury cap (fail-open) | config | MEDIUM |
| 7 | Non-ASCII `X-API-Key` → `TypeError` → 500 instead of 403 | api/auth | LOW |
| 8 | `ratelimit.py` docstring contradicts its own key function | api | LOW |
| 9 | Clone Room mints anchor a metadata hash for a document that is never published | chain | LOW |
| 10 | Weather clamp with a one-sided bound raises `TypeError` / silently skips | services | LOW |
| 11 | Dead code: 1 orphan helper + 3 never-used test hooks | services | LOW |
| 12 | Broad `except Exception` swallows genome-expression failures | services | LOW (flag) |

---

## HIGH

### 1. Model ↔ migration drift: 4 tables exist only via boot-time `create_all`

**Evidence (mechanical):** `alembic upgrade head` onto a scratch DB, then `alembic check`
against `Base.metadata` → FAILED with:
- added table `bundles` (`db/models.py`)
- added table `featured_items`
- added table `store_partners`
- added table `player_badges` + unique index `uq_player_badges_player_key`
- type change `seasonal_strains.price_gc`: migrations say `NUMERIC(18, 8)`, the model says
  `MONEY = Numeric(18, 6)` (`db/models.py:40`)

**Why prod hasn't noticed:** `create_app` calls `init_db()` on every boot
(`api/flask_api.py:58-59`), and `init_db` runs `Base.metadata.create_all(checkfirst=True)`
(`db/session.py:72-81`). Fly's `release_command = "alembic upgrade head && …"` (`fly.toml:35`)
runs first, then the app boot quietly creates whatever alembic didn't know about. So the
prod Postgres schema is part-managed, part-unmanaged.

**Failure scenario:** the next dev to run `alembic revision --autogenerate` gets these four
tables re-emitted into their migration; `alembic upgrade head` in the release command then
dies with `DuplicateTable` on deploy — a deploy-time outage for an unrelated change. The
`price_gc` scale mismatch also means Postgres physically stores scale-8 values for a column
the code treats as scale-6 money.

**Fix:** one catch-up migration that creates the four tables **idempotently** (guard with
inspector `has_table`) and alters `seasonal_strains.price_gc` to `Numeric(18,6)`; then add
`alembic check` to CI next to the existing `alembic upgrade head` step
(`.github/workflows/ci.yml:53`) so drift can never silently accumulate again. (The 2026-06-10
fleet sweep verified "no drift" — these tables all postdate it; without a CI gate this class
of finding just regrows.)

### 2. `SettlementService` can fire an implicit treasury asset-create

**Evidence:** `services/settlement_service.py:45`:
```python
self.asset_id = asset_id or self.settings.asa_id or create_token_asa(self.provider, self.cfg)
```
The service is constructed per request (`api/game_api.py:1785`, `:1801`). With a real
provider configured (mnemonic set, mock not forced) and `ASA_ID` unset — a one-line secrets
mistake — the **first withdraw/deposit request signs and submits a real `AssetCreateTxn`**
with the treasury key, with no confirmation step and no operator intent. Worse, the created
id isn't persisted anywhere: every worker (and every construction after a config reload)
mints **another** ASA, and withdrawals then transfer units of an asset no player has opted
into or holds.

**Fix:** implicit creation is only sane on the mock. Mirror the deposit fail-closed pattern
(`settlement_service.py:163-167`): if the provider is not `MockChainProvider` and
`settings.asa_id` is unset, raise (`GameError("GROW ASA is not provisioned …")`) instead of
creating. Explicit provisioning already exists (`scripts/reset_asa.py`).

## MEDIUM

### 3. No mainnet/testnet guard rail beyond a config string

**Evidence:** `chain/algorand.py:21-41` stores `network_name` as a pure label; nothing in
`chain/` ever queries the node's genesis id (grep: no `genesis` anywhere in the package).
`config.py:127-130` defaults `ALGORAND_NETWORK=testnet` and `ALGOD_URL=https://testnet-api…`
independently — they can disagree. If `ALGOD_URL` is pointed at a mainnet node (typo, copied
env block), every treasury transaction fires on **MainNet** while `/api/chain/*` responses
and logs keep reporting `"network": "testnet"` (`api/chain_api.py:63`).

**Fix:** on `AlgorandProvider.__init__`, fetch the node's genesis id
(`client.suggested_params().gen`, e.g. `testnet-v1.0` / `mainnet-v1.0`) and raise
`ChainError` when it doesn't match the configured network. One RPC at construction, and the
label becomes a contract.

### 4. Postgres connections: no liveness handling on the pool

**Evidence:** `db/session.py:51-56` — `create_engine(...)` with no `pool_pre_ping` /
`pool_recycle`. SQLite gets pragmas; Postgres gets defaults. Fly's proxy and Postgres both
reap idle connections, so the first request after a quiet period draws a dead connection
from the pool → `OperationalError` → 500 (the generic handler at `api/errors.py:38-41`).
Low-traffic hours make this a recurring first-request failure.

**Fix:** `pool_pre_ping=True` (and optionally `pool_recycle=300`) when the URL isn't SQLite.
Cheap, standard, and `readiness` (`api/observability.py:66-73`) won't mask it because
gunicorn workers each own their pool.

### 5. Contract expiry never persists

**Evidence:** `services/contract_service.py:73-75`:
```python
contract.status = "expired"
raise GameError("Contract deadline has passed")
```
The route wraps the call in `session_scope()` (`api/game_api.py:1150-1159`), whose
`except → rollback` (`db/session.py:91-93`) discards the status write. An expired contract
therefore stays `"open"` in the DB forever — it only *reports* expired when someone retries
`fulfill`. Anything that filters `status == "open"` (`contract_service.py:59-63`) counts
zombie contracts.

**Fix:** persist the flip outside the failing transaction — e.g. return an
`{"expired": true}` payload instead of raising (letting the scope commit), or re-mark in a
fresh short transaction before raising. Add a test that asserts the row reads `"expired"`
after a past-deadline fulfill attempt.

### 6. Empty `MAX_WITHDRAWAL_PER_DAY` fails open

**Evidence:** `config.py:121-122`:
```python
wd_cap = os.environ.get("MAX_WITHDRAWAL_PER_DAY", "10000")
self.max_withdrawal_per_day = wd_cap if wd_cap not in (None, "") else "0"
```
`""` → `"0"`, and `_enforce_daily_cap` treats `cap <= 0` as *cap disabled*
(`settlement_service.py:62-64`). So `fly secrets set MAX_WITHDRAWAL_PER_DAY=` (an easy way to
"unset" a var) removes the treasury's defence-in-depth entirely, silently. A misconfiguration
on a real-money boundary should fail closed.

**Fix:** empty/unset → the `10000` default; reserve cap-disable for an explicit `"0"`.

## LOW

- **7. Non-ASCII API key → 500.** `hmac.compare_digest(provided, expected)` on `str` raises
  `TypeError` for non-ASCII input (`api/auth.py:39`, `:74`; verified in-interpreter). Flask
  decodes headers as latin-1, so a stray byte ≥ 0x80 in `X-API-Key` yields a logged 500
  instead of a 403. Encode both sides (`.encode()`) before comparing.
- **8. Rate-limit docstring drift.** `api/ratelimit.py:6-7` says requests are "keyed by API
  key when present"; `_rate_key` (`:22-28`) deliberately keys by IP only, with a comment
  explaining why. Fix the module docstring — the next reader will trust the wrong one.
- **9. Unverifiable metadata hash.** `/api/chain/mint-seed` and `/mint-harvest` anchor
  `metadata_hash` on-chain but pass `url=None` (`api/chain_api.py:52-53`, `:97-98`) and the
  metadata JSON is never published or served, so the "independently verifiable" property
  (`chain/metadata.py:23-25`) can't actually be exercised by a third party. Either serve the
  ARC-3 document at a stable URL or soften the claim.
- **10. One-sided weather clamps.** `services/weather_service.py:90-92` unpacks
  `lo, hi = clamps.get(key, [None, None])` then calls `min(hi, …)` guarded only on `lo`:
  a `[5, null]` clamp raises `TypeError`, a `[null, 40]` clamp silently doesn't clamp.
  Data-robustness only — current `balance.yaml` supplies both bounds.
- **11. Dead code.** `assessment_service.module_items` (`services/assessment_service.py:237`)
  has zero references repo-wide; `effects_service._reset_caches` (`:69`),
  `factions.reset_cache` (`:35`), `skills.reset_cache` (`:38`) are test hooks no test calls.
  Delete the orphan; either use or drop the hooks.
- **12. Swallowed genome-expression errors** *(flag for the domain-layer pass)*.
  `services/effects_service.py:100-102` wraps `express_terpenes(genome)` in a bare
  `except Exception:` → `{}`, masking real failures as "no terpene nuance." Confirming the
  right behavior requires the genetics module — **out of scope here; queued for the
  domain-layer audit session.**

## Verified-solid (checked, not assumed)

- **Guard coverage is complete:** every mutating `game_bp` route carries `@require_player`
  or `@require_admin`; sensitive ones add tighter per-route limits on top of the global
  default (`RATELIMIT_DEFAULT`, `config.py:105-107`). Admin auth is layered and fails closed
  in prod without `ADMIN_SECRET` (`api/auth.py:46-101`).
- **Error discipline holds:** the ~80 `_error(str(e))` sites in `game_api.py` all catch
  domain exceptions with intentional messages; the two broad catches (`:1589`, `:1606`)
  log and return bodyless responses. Unexpected exceptions → generic 500
  (`api/errors.py:38-41`). No internals leak.
- **Secrets hygiene is clean:** no secret values logged anywhere in `api/`/`chain/`;
  `api_key` leaves the API exactly once, at player creation (`api/game_api.py:149`);
  `.env*` ignored at both roots with only templates tracked; mnemonic never serialized.
- **Settlement/minting hardening from #144 holds:** commit-before-chain-call ordering with
  optimistic-lock loser exclusion (`settlement_service.py:102-117`), deposit fail-closed
  off-mock (`:163-167`), daily treasury cap, compensating credit on chain failure.
- **Models:** money is `Numeric(18,6)`/`Decimal` throughout, `version_id_col` optimistic
  locking on Wallet/Strain/Harvest, composite indexes cover the hot queries (incl.
  `ix_ledger_player_created` behind the daily cap).
- **Services sweep:** zero TODO/FIXME debt in `api/`, `chain/`, `db/`, and the swept
  services; every swept service has real test coverage (weakest: `factions.py`, incidental
  only); no float-money violations — every posting flows through `ledger.to_money()`.

## Gates

- `make test` → 1122 passed, 6 skipped; coverage 93.64% (floor 79%) — green
- `make check-memory` → OK (37 files)
- `alembic upgrade head` (scratch DB) → OK; `alembic check` → **FAILED** (finding #1, expected)

## Suggested PR queue (owner rule: one active PR at a time)

1. **db: catch-up migration + `alembic check` CI gate** (#1) — protects every future deploy.
2. **chain/settlement: fail-closed ASA provisioning + genesis-ID guard** (#2 + #3) — one
   small PR, both are "config mistake ≠ on-chain surprise" rails.
3. **db/config: `pool_pre_ping` + withdrawal-cap fail-closed + contract-expiry persist**
   (#4, #6, #5) with tests.
4. **Sweep PR** for the LOWs (#7, #8, #10, #11) — mechanical.

Finding #12 hands off to the domain-layer audit session (needs `genetics/` context).
