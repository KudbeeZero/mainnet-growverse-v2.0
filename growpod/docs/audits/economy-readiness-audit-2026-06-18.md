# GrowVerse / GROWv2 — Economy Readiness Audit

**Date:** 2026-06-18
**Branch:** `claude/economy-readiness-audit-ifuc7k`
**Mode:** READ-ONLY (no code, config, migrations, or PRs changed during the audit)
**Method:** 10 specialized read-only sub-agents + direct verification of contested findings.

> Status: this is the preserved audit record. Implementation is sequenced as separate
> safety PRs (see §7). Launch values (`daily_stipend`, `seeds.base_cost`, `time_scale`)
> remain owner-ratified and unchanged — the free-playtest baseline is preserved.

---

## 1. Executive Summary

The GROWv2 economy is **architecturally sound but not launch-safe today.** Foundations are
strong: a single `Decimal` ledger chokepoint (`economy/ledger.py:post`), ~95% config-driven
balance via one typed loader over `balance.yaml`, server-authoritative yields/prices (the
client cannot inject value), per-player API-key auth with consistent ownership checks, and real
DB-level protection on *debit* paths (`Wallet.version` optimistic lock + `CHECK(cached_balance >= 0)`,
`MarketListing.version`, and unique indexes for grants/research/cup-entry/harvest-per-plant).

The blocking weakness is **credit/payout idempotency under concurrency.** The four reward
faucets — daily stipend, achievement claim, contract fulfill, cup prize — all use a non-atomic
read-then-write with no unique constraint and no row lock, while prod runs `gunicorn -w 2`. A
normal player key can replay these to mint currency. Root cause: **no unique index on
`LedgerEntry(player_id, ref_type, ref_id)`** (and the daily stipend posts with no ref at all).

Separately, "free-playtest" and "forced-ON features" are **not flags** — they are committed
*data state* (`seeds.base_cost: 0`, frontend `FEATURES` hardcoded all-`true` with the env path
commented out) guarded only by code comments. The project's own canonical docs state real-value
go-live is explicitly blocked by carried **RISK #4/7 (chain settlement not real)**.

**Safe to flip economy live now: NO.** (See §8.)

---

## 2. Economy Map

**Single chokepoint:** every value movement is `economy/ledger.py:post(session, player_id, amount,
entry_type, ...)` — positive = source, negative = sink; appends an append-only `LedgerEntry` and
updates `Wallet.cached_balance`. `economy_service.economy_health()` reconciles wallet supply vs.
the signed ledger sum.

### Sources (faucets)

| Source | Trigger | file:line | Config-driven |
|---|---|---|---|
| Starting grant (500) | signup | `game_service.py:127` | ✅ `starting_balance` |
| Daily stipend (5000) | `claim_daily` | `progression_service.py:56` | ✅ `daily_stipend` |
| **Harvest sale (primary earn)** | harvest/sell | `game_service.py:1046` | ✅ `harvest.*` |
| Achievement reward | claim | `progression_service.py:87` | ✅ |
| Contract reward | fulfill | `contract_service.py:105` | ✅ |
| Cup prize | judge | `cup_service.py:207` | ✅ (not pool-bounded) |
| Auction refund / ASA deposit | bid outbid / chain | `game_service.py:1273` / `settlement_service.py:129` | transfer/chain |

### Sinks

seed purchase (`game_service.py:335`), nutrients/pest/disease care (`simulation_service.py:123/136/150`),
pod buy/upgrade (`:534/573`), breeding/stabilize (`:631/729`), **plant cleanup (hardcoded 25)**
(`:1011`), market listing fee + sale-tax burn (`:1163/1190`), research (`research_service.py:127`),
tuition (`university_service.py:176`), shop/gear/bundle/partner (`game_service.py:404/459`,
`game_api.py:1705/1761`), cup entry fee (`cup_service.py:148`), ASA withdrawal (`settlement_service.py:91`).

### Loops

(A) core grow: buy seed → care → harvest → sell; (B) daily/onboarding faucet; (C) breeding;
(D) marketplace player↔player (tax burned = primary anti-inflation); (E) progression spend
(research/tuition/pods); (F) cup; (G) chain mirror.

### Surfaces & flags

- **Backend:** `api/game_api.py` (~1,871 LOC, master surface); 21 services; all writes atomic via `session_scope()`.
- **Frontend:** `web/src/app/{store,market,lab,university,cup,dashboard,profile,admin/economy}`; mutation layer `web/src/lib/api/*.ts` sends **only IDs + flags** (no client money).
- **Feature flags:** backend = real yaml+env mechanism (`feature_flags.py`, defaults all `true`); frontend = dead/forced-ON (`web/src/lib/features.ts:18-24`).
- **Chain/token:** mock by default (`chain/mock.py`); real Algorand is TestNet, opt-in, not on CI/default path; "Not live" per `docs/memory/CANONICAL_STATE.md:31`.

---

## 3. Hardcoded Economy Values

| File:line | Value/rule | Use | Risk | Recommended fix |
|---|---|---|---|---|
| `balance.yaml:16` | `seeds.base_cost: 0` ("restore to 25 before launch") | seeds are FREE | **HIGH** — ships free economy, guarded only by a comment | Launch guard/test asserting `> 0`; restore to 25 (owner sign-off) |
| `balance.yaml:13` | `daily_stipend: 5000` (vs starting 500; docs say 50) | daily faucet | **HIGH** — 10× starting grant, uncapped inflation | Restore to documented ~50 (owner sign-off) |
| `game_service.py:1011` | `cleanup_cost = 25` | plant cleanup sink | **MED** — invisible to tuning surface; missing from `economy_service` SINK_TYPES (under-reports burn) | Move to `balance.yaml`; add `POD_CLEANUP` to taxonomy |
| `web/.../CreatePodForm.tsx:14` | `{basic:100,standard:400,pro:1200}` | displayed pod prices | **MED** — silent drift from server | Fetch from API |
| `web/.../CareButtons.tsx:38,48` | `· 10 🌿` water/feed cost | displayed care cost | **MED** — drift; actual costs 5/15/20 | Fetch from API |
| `web/.../OnboardingPanel.tsx:215` | "started with 500 GC" | onboarding copy | LOW | Derive from config |
| `game_service.py:972,984` | `0.4+0.6*health`, `0.85+0.15*health` | harvest yield/terpene curve | MED — core faucet-shaping constant in code | Surface under `harvest.*` |
| `pricing.py:35,68` | `0.5+0.5*q^exp`, THC pivot `15.0` | quality/THC reward | LOW-MED — only half configurable | Add `quality_floor`, `thc_baseline_pct` |
| `game_service.py:333,629,727`, `simulation_service.py:60` | `min(0.9, …)` discount cap (×4) | 90% discount guardrail | LOW — duplicated, driftable | Add `research.max_discount_pct` |
| `badge_service.py:161-170` | thresholds `>=10/50/100` | badge unlocks (no currency) | LOW | Move to config |

No config schema/validation layer exists — `balance.yaml` is loaded as a raw dict (`@lru_cache`);
missing keys are `KeyError`/silent `.get` fallbacks; code-side default duplicates can drift from yaml.

---

## 4. Risk Register

### CRITICAL — block live

- **C1 Daily-stipend concurrent double-claim** — `progression_service.py:34-58`. Read-then-write cooldown, no lock/unique index. Burst (≤30/hr) mints multiple stipends. **Blocks live.**
- **C2 Achievement claim double-claim/replay** — `progression_service.py:77-105`. No per-route rate limit, no unique constraint. Repeatable faucet. **Blocks live.**
- **C3 Contract fulfill reward replay** — `contract_service.py:65-113`. `status` read at :69, flipped at :112, reward posted at :105 in between; concurrent fulfills double-pay. **Blocks live.**

### HIGH

- **H1 Cup prize double-payout** — `cup_service.py` `judge()` auto-fires on a **public unauthenticated read**; status-only guard, no lock → concurrent reads double-pay every prize. **Blocks live.**
- **H2 Withdrawal daily-cap bypass** — `settlement_service.py:82-114`. Cap sums only flushed rows; concurrent withdrawals each pass → treasury over-drain. **Blocks real settlement.**
- **H3 No chain↔DB idempotency** — `settlement_service.py:99-133`. `transfer_asset` then stamp txid; post-transfer DB failure/retry desyncs or double-transfers. **Blocks real settlement** (owner sign-off per charter).
- **H4 Stipend/free-state ships by accident** — `balance.yaml:13,16`. No test/flag guards `daily_stipend`/`base_cost`. **Blocks live** until a guard exists.
- **H5 Frontend feature flags dead/forced-ON** — `web/src/lib/features.ts:18-24`; `computeFeatures` commented out (`:31-61`), so launch cannot toggle non-MVP surfaces client-side. Env overrides also **not set in `render.yaml`** (every gated surface deploys ON). **Blocks the off-chain-MVP launch plan.**
- **H6 Bundle purchase bypasses service guards** — `game_api.py:1672-1747`. No `bundle_price > 0` check before `post()` (admin-authored input, so conditional).

### MEDIUM

- **M1** Contract over-consumes partial harvests whole, destroys overage uncompensated — `contract_service.py:97-103` (fairness).
- **M2** `ledger.post` blocks only negative *balances*, not negative-signed *costs* — a misconfigured negative cost mints with no guardrail (`ledger.py:64`).
- **M3** `complete_course` double-awards XP under concurrency (`university_service.py`) — no currency, feeds leveling.
- **M4** Unbounded client `water`/`feed` amount, non-atomic consumable decrement (`simulation_service.py`).
- **M5** Web vitest + Playwright are **echo stubs** (`web/package.json` `test`/`test:e2e`); the broken `computeFeatures` test never runs → "web tests green" is vacuous. No web coverage floor; backend single global 79% floor (`pyproject.toml:20`).
- **M6** `create_pod` 500s on unknown tier (`game_service.py:533`); `cup`/`stipend` docstrings claim "ledger is the guard" but the real guard is a status field (doc/code mismatch).

### LOW

Cleanup sink missing from inflation taxonomy; mint endpoints status-only idempotent; admin
dev-fallback accepts any player key when `APP_ENV≠production` (`auth.py:43-89` — verify prod env);
contract `offer()` signature accepts an RNG seed (not wired to route, latent seed-shopping);
zero-amount ledger rows on free buys.

### Confirmed NON-issues (verified directly)

- Harvest/sale value is server-authoritative — route forwards only `sell` (`game_api.py:424`, anti-cheat comment + `test_security.py`).
- Debit double-spend, double-harvest, and auction fund-stranding are DB-enforced and tested (`test_concurrency.py`, `test_marketplace_concurrency.py`).

---

## 5. Required Simulation Tests

Target new `tests/test_economy_simulation.py`, driving the **HTTP API** with the dev clock
(pattern from `test_e2e_grow_loop.py`), asserting solvency via `economy_service.economy_health`
(reconciled == True, never-negative):

1. **New-player day-1** — signup → claim daily → grow/care/harvest/sell; balance within band, never negative; per-player net_issuance == faucets−sinks.
2. **Day-7 progression** — 7 daily claims (clock +22h each) + grows/sells; exactly 7 `DAILY_STIPEND` entries; cumulative issuance within an inflation band.
3. **Claim loop** — daily + achievement + contract + cup, each invoked twice; each pays exactly once.
4. **Upgrade loop (ROI)** — baseline yield vs. after gear buy+equip; cost debited, yield/value rises, net positive but bounded.
5. **Production loop** — 10× grow→harvest→sell; one `HARVEST_SALE` per cycle, bounded by server yield cap, linear (not exponential) issuance.
6. **Feature OFF** — gated route 404 **and** no faucet ledger entry of that type; core loop still pays.
7. **Feature ON** — gated faucet pays correct type+amount and is classified by `economy_health`.

---

## 6. Required Hardening Tests

Target `tests/test_security.py`, `tests/test_concurrency.py`, new `tests/test_exploits.py`:

- **Duplicate rewards (HTTP):** daily stipend twice → 1 credit; achievement twice → 1 credit.
- **Race (priority):** concurrent daily stipend / contract fulfill / cup judge — exactly one payout each (these will likely *fail today* → they prove C1/C3/H1).
- **Replay:** re-sell sold harvest → 400; cup double-entry over HTTP → blocked.
- **Wallet/user mismatch (IDOR):** sell/cure/mint/contract-fulfill/claim another player's resource → 403.
- **Stale timers/clock:** dev clock disabled in prod (`/api/dev/clock/advance` → 404); stipend cooldown not client-skewable.
- **Client manipulation:** injected `sale_value`/`amount`/`reward`/`entry_type` ignored; ledger type server-chosen.
- **Negative/zero cost:** qty 0/negative/fractional rejected; property test — every catalog price strictly > 0; `ledger.post` rejects positive-signed sink.
- **Forced-ON leakage:** unknown `FEATURE_*=true` exposes no route; flag OFF still blocks the **service** (gate is route-only today); frontend force-ON cannot unlock a server-OFF faucet.

---

## 7. Recommended PR Plan (smallest safe sequence)

1. **PR 1 — Audit docs (this file) + safe config/taxonomy fixes (no balance changes).** Move `cleanup_cost` to `balance.yaml` + add `POD_CLEANUP` to SINK_TYPES; fix `create_pod` unknown-tier 400; restore real `web/package.json` test scripts; fix the broken `features.test.ts`/`computeFeatures` import. *No faucet/sink value changes.*
2. **PR 2 — Simulation + exploit tests (red).** Add §5/§6 tests; concurrency/replay tests document C1–C3/H1 as failing. No fixes yet.
3. **PR 3 — Idempotency hardening (turns PR 2 green). [APPROVED — safety only]** `LedgerEntry` uniqueness + idempotency-key enforcement (Alembic) with row-lock/status-before-payout on stipend, achievement, contract, cup; serialize the withdrawal cap; negative-cost guard in `ledger.post`. **No tuning, no go-live.**
4. **PR 4 — Frontend flag restoration + defense-in-depth.** Restore `computeFeatures`/env path (fail-closed for live); remove hardcoded FE prices; verify service-layer feature gating.
5. **PR 5 — Chain settlement idempotency (H2/H3).** Owner sign-off; gated behind RISK #4/7.
6. **PR 6 — Flip economy live via config only.** Launch values + `FEATURE_*` env in `render.yaml`. **Owner sign-off (faucet/sink change per CLAUDE.md charter).**

Migrations note: PR 3's unique index must reconcile with the Alembic single-head requirement
(`scripts/check_single_head.py`) and the prod `preDeployCommand: alembic upgrade head` auto-deploy
from `main`.

---

## 8. Final Decision

**Safe to flip economy live now: NO.**

The economy's foundation is well built — one auditable ledger, config-driven balance,
server-authoritative values, solid auth and solid protection on the spend side. Three things stop
it from being live-safe right now:

1. Four reward paths (daily stipend, achievements, contracts, cup) can be **replayed under
   concurrency to print currency**, because they lack a single missing database guard and prod runs
   two workers — exploitable by an ordinary player.
2. The "test economy" is **active by accident, not by design**: seeds are free and the daily bonus
   is 10× too large, held back only by code comments with no guard, while the frontend feature
   switches are welded ON and the launch env vars aren't set.
3. The project's own canonical docs declare real on-chain settlement (**RISK #4/7**) an explicit
   do-not-ship gate, and that path additionally has cap-bypass and no chain↔DB idempotency.

**What must happen first:** ship the `LedgerEntry` uniqueness + locking to close C1–C3/H1; add
tests proving duplicate-claim/replay are dead; make the web test runner real; restore real
feature-flag control (fail-closed for live); and make the live values a deliberate, guarded,
owner-approved config flip — not a leftover. Real-value/chain go-live stays blocked until RISK
#4/7 (H2/H3) is closed with owner sign-off.
