# Economy Readiness Audit

**Date:** 2026-06-18
**Scope:** Read-only audit. No code changed. Economy NOT flipped live. PR #8 untouched.
**Method:** 10 parallel sub-agent audits cross-checked against `file:line` evidence.

> **Headline:** The economy's **spend/sink side is genuinely well-built** (single ledger
> choke point, optimistic locking + DB `CHECK(balance >= 0)`, server-authoritative
> prices, input validation). The unsafe surface is **faucets, feature-gating, and
> tuning config** — and a key premise of the task is wrong: **there is no economy
> feature flag and no kill-switch.** The core money loop runs whenever the server runs.

---

## 1. Economy Map

### Engine / choke points
- **`economy/ledger.py::post()`** — the single write path for all money. Quantizes to
  `Decimal` (6 dp), computes `new_balance`, raises `InsufficientFundsError` if it would
  go negative (`allow_negative` is never set true anywhere). Backed by `Wallet`
  optimistic lock (`version_id_col`) **and** DB `CHECK(cached_balance >= 0)`.
- **`economy/pricing.py`** — pure Decimal pricing: `seed_price`, `breeding_fee`,
  `harvest_value` (weight × per-gram × rarity × THC × terpene × quality, soft-capped),
  `quality_factor`, `cup_score`.
- **`economy/config.py`** — loads `data/balance.yaml` into a frozen `EconomyConfig`
  (lru-cached). **No schema/bounds validation.**
- **`services/economy_service.py`** — read-only reporting only (faucet/sink/inflation
  dashboard, `economy_health`, `ledger_daily_summary`). Moves no money.

### Sources (faucets — value IN)
| Flow | Amount source | Entry point |
|---|---|---|
| Starting grant (500) | `balance.yaml` | `POST /players` (idempotent via `GrantClaim`) |
| Daily stipend (**5000**) | `balance.yaml` | `POST /players/{id}/daily` — cooldown, **no DB unique** |
| Harvest sale (~1,700/rare cycle) | server plant sim | `harvest` / `sell` (`sold` flag guard) |
| Achievement rewards (100–1000) | `balance.yaml` | `achievements/{key}/claim` — **no DB unique** |
| Contract reward (250/400/700) | `balance.yaml` template | `contracts/{id}/fulfill` (status guard) |
| Cup prizes (2500/1200/600/200×7) | `balance.yaml` | `cup judge` (status guard) — **not bounded by entry-fee pool** |
| NFT mint | — | mint routes — **no GROW sink; `first_nft` pays 250** |

### Sinks (value OUT)
Seed buy (**base_cost: 0**), nutrients/pest/disease, pods (100/400/1200), breeding fee,
market listing+sale tax (burned), research nodes (350–2500, monotonic), shop/gear, cup
entry (100), tuition, plant cleanup (hardcoded 25), ASA withdraw (daily cap **disabled by
default**). All costs are server-side from config; all spends route through `post()` →
affordability + atomicity guaranteed.

### Config files
`data/balance.yaml` (the tuning dial), `strains.yaml` (DB-seeded), `curriculum.yaml`,
`terpene_effects.yaml`, `strain_knowledge.yaml`. Loaded via safe YAML, process-lifetime
cache, **no validation on load**.

### APIs
Flask blueprints under `api/` (the shipped `openapi.yaml` is a 778-byte stub — ignore it).
Auth = `X-API-Key` matched to URL `player_id` in constant time; every secondary-id method
re-checks ownership. **No IDOR/cross-user write path found.** Economy-mutating endpoints
inventoried in agent reports; peripheral surfaces (marketplace, chain, contracts, cup,
university, seasonal) carry `@require_feature`; **core loop does not.**

### UI surfaces
Store, marketplace, contracts, cup, university, harvests, breeding, care buttons, player
badge, profile. All economy numbers read from server **except**: `ListingCard` total is
computed client-side (display only), and care buttons show a **hardcoded "10 🌿"** cost
not backed by any config value. No optimistic balance writes — every mutation re-fetches.
**All economy UI is forced-visible** (flag layer disabled).

### Loops
Grow → harvest → sell → buy seeds/upgrades → grow. At current tuning this loop is
**strongly net-positive and uncapped** (see Risk C3).

---

## 2. Risk List (ranked)

### CRITICAL
- **C1 — No economy kill-switch / no economy flag.** Core loop (`buy_seed`,
  `plant_seed`, `sell_harvest`, `shop/buy`, `breed`, `claim_daily`) has **no
  `@require_feature` gate** (`game_api.py:316/371/426/...`). There is nothing to "flip."
  The task's premise that the economy "has not been flipped live" is unfounded — it runs
  whenever the server runs, with no off-ramp for an incident.
- **C2 — Web flags forced-ON; `computeFeatures` disabled.** `features.ts:18-24` hardcodes
  all flags `true`; the env-driven `computeFeatures` reader (`:31-61`) is **commented
  out**. `computeFeatures` is therefore test-only — but the "zero app-behavior change"
  claim is **false**: that change removed the client's only gating mechanism, so
  `RequireFeature`, nav filtering, and the chain UI are all inert. No env can hide an
  unfinished surface.
- **C3 — Inflationary launch config.** `balance.yaml`: `seeds.base_cost: 0` (the primary
  sink is disabled — comment says "restore to 25 before launch"), `daily_stipend: 5000`
  (10× the entire starting balance; docs say it should be 50 — a 100× drift), and
  `time_scale: 0.075` (~13× faucet rate vs static prices). Combined → free input yields
  ~1,700 GROW/cycle with no matching recurring sink. The economy nets positive with no
  ceiling. **Pure config; owner-ratified change.**

### HIGH
- **H1 — Faucets lack DB-level idempotency.** `daily_stipend` and `achievement claim`
  guard only via query-then-insert inside a non-serializable transaction with **no unique
  constraint** (`models.py:116` ledger has no `UNIQUE(player_id, entry_type, ref_id)`).
  Concurrent requests double-credit. (Contrast: starter grant, research, course, cup,
  harvest are unique-indexed and safe.)
- **H2 — No config validation/bounds.** `economy/config.py` does `float(raw[...])` with no
  schema, no bounds, no non-negativity check. A negative/zero/typo'd value (e.g. negative
  price) reaches pricing/payout math unchecked and fails at use-time, not load-time. A
  negative "cost" would become a faucet.
- **H3 — Cup prizes not bounded by collected entry fees.** `cup_service.py:200-239` pays
  fixed `balance.yaml` amounts regardless of pool — a net faucet/inflation leak.
- **H4 — Doc/code drift hides intent.** Docs: stipend = 50, launch flags = OFF, `chain`
  off. Code: stipend = 5000, all flags default ON including `chain` (which has an OPEN
  settlement-safety risk). Launch flag matrix exists in no committed config.

### MEDIUM
- **M1 — Withdrawal daily cap disabled by default** (`config.py:102`,
  `max_withdrawal_per_day = "0"` ⇒ treated as off). Treasury drain bounded only by in-game
  balance once a real chain provider is wired (currently mock).
- **M2 — Hardcoded economy values outside config:** `cleanup_cost = 25`
  (`game_service.py:1011`), FE care cost "10 🌿" (`CareButtons.tsx:38,48`), ledger `QUANT`
  6 dp vs config `decimals` (drift → on-chain reconciliation mismatch).
- **M3 — Minting has no GROW sink** while paying a 250 achievement — a free value creator;
  design docs intend mint to be a *sink*.

### LOW
- **L1 — ASA withdraw does the on-chain transfer inside the open DB transaction**
  (`settlement_service.py:100`): crash-after-transfer-before-commit over-credits the
  treasury side. Mock provider hides it; needs idempotency/2-phase before real chain.
- **L2 — Admin dev-fallback** accepts any player key off-prod (prod locked, 503).
- **L3 — Unbounded client `amount` on water/feed** (clamped ≤100; 500 on bad type only).
- **L4 — Client-side `unit_price * quantity`** display math (`ListingCard.tsx:124`); buy
  sends no amount, so display-only drift.
- **L5 — Duplicated rank ladder** FE `rank.ts` mirrors backend with no sync check.

### What is already solid (do NOT re-audit / do NOT backfill)
Overdraw/affordability, double-spend optimistic lock, harvest-once, ledger reconciliation,
flag fail-closed (backend), starter-grant idempotency, server-authoritative pricing,
`positive_money` rejecting ≤0/NaN/inf/huge, atomic debit+grant, no client-supplied costs,
no optimistic FE balance writes.

---

## 3. Required Simulation Tests (before live economy)

Reuse the existing dev-clock + HTTP + `economy_health()` stack (pattern:
`tests/test_e2e_grow_loop.py`); the plant engine is NOT an economy driver. New file:
`tests/test_economy_sim.py`, marked `@pytest.mark.sim`, deterministic (fixed epoch + seeded
RNG), mocks only.

**Live-blocking:**
- **Inflation/deflation sim** (cohort, N≈90 days): assert `economy_health().reconciled`
  every snapshot, per-day supply growth `(minted-burned)/supply < ~2%`, supply asymptotic
  not divergent. *(Will FAIL on current config — that is the signal to fix C3.)*
- **Adversarial/exploit sim:** bot spams `claim_daily`/sell/buy → assert exactly one
  faucet payout per cooldown, one sale per harvest, balance never < 0, no
  negative/oversized input mints currency.

**Nice-to-have (launch-soon):** normal progression-curve sim (no instant-win / no
soft-lock band), whale-vs-new-player fairness, sink/source steady-state ratio (≥ ~0.8).

**Safety contract (invariants every sim asserts):** balance never negative without
`allow_negative`; ledger always reconciles; Decimal-only money; advancing time posts zero
entries; every faucet bounded + idempotent; supply growth bounded; no infinite-currency
cycle; bonuses capped (additive, `max_quality`, harvest soft-cap).

---

## 4. Required Hardening (before live economy)

1. **Add an economy kill-switch flag** that genuinely gates the core loop
   (`buy_seed`/`plant_seed`/`harvest`/`shop/buy`/`breed`/`claim_daily`) — with tested OFF
   behavior. (C1)
2. **Add `validate_economy_config()` on load** — reject negative/zero base costs, negative
   multipliers, assert payout ceilings; fail closed at startup, not at use-time. (H2)
3. **Add DB unique constraints for one-shot/per-period faucets** —
   `UNIQUE(player_id, entry_type, ref_id)` for achievements, a per-day key for stipend.
   (H1)
4. **Bound cup prizes by collected entry-fee pool.** (H3)
5. **Restore the web flag gating** (`computeFeatures` env path) + make `web` tests
   actually runnable in CI (vitest dep + real `test` script). (C2)
6. **Set a non-zero default withdrawal cap**; add mint sink or document mint as the
   intended sink; move `cleanup_cost` and FE care cost into config; align ledger `QUANT`
   with config decimals. (M1/M2/M3)
7. **Owner-ratified `balance.yaml` retune** for launch: `seeds.base_cost`,
   `daily_stipend`, `time_scale` (these are player-facing economy changes → owner sign-off
   per `CLAUDE.md`). (C3) — *separate, ratified PR.*
8. **Handoff docs:** Economy Go-Live Runbook, Rollback Plan, Invariants/Safety Contract,
   Config-Change Procedure. (H4)

---

## 5. Recommended First PR Scope — "Economy Control Plane" (safety scaffolding, no balance changes)

**One responsibility: make the economy controllable, validated, and idempotent — with no
change to tuning values and no flipping live.**

- Introduce a real **`economy` feature flag** (default behavior = current ON, so zero
  behavior change) and gate the core loop routes; add tested OFF behavior. (C1)
- Add **`validate_economy_config()`** + bounds/non-negativity, called on load; unit tests.
  (H2)
- Add **DB unique constraints** for stipend (per-day) and achievement faucets + Alembic
  migration + concurrent-race tests. (H1)
- Add the two **live-blocking simulation tests** (inflation + adversarial), wired into CI
  as a `sim` job. (Section 3) — these will fail on current config, documenting the gap.
- Add **negative-cost / config-bounds regression tests** and pricing non-negativity
  property tests. (H2)
- Add the **handoff docs** (runbook, rollback, invariants, config procedure). (H4)
- **Explicitly out of scope:** any `balance.yaml` value change, flipping economy live,
  PR #8, general coverage backfill, frontend flag restore.

Gates: `make test` / `make lint` / `make check-memory` green; new `sim` tests
green-or-quarantined with the inflation sim documented as the C3 tracking failure.

## 6. Recommended Second PR Scope — "Economy Tuning + Web Gating" (owner-ratified)

Only after PR-1 lands and the owner ratifies values:

- **Retune `balance.yaml`** for launch: `seeds.base_cost` → 25, `daily_stipend` → ~50,
  `time_scale` to a launch value, cup-prize pool bound, add mint sink. (C3/H3/M3)
- Make the **inflation sim pass** against the new values (proves the retune works).
- **Restore web flag gating** (`computeFeatures` env path) + runnable web tests in CI. (C2)
- Move remaining **hardcoded economy values into config** (cleanup cost, FE care cost,
  QUANT/decimals alignment); set non-zero withdrawal cap default. (M1/M2)
- Settlement hardening (idempotency / 2-phase) only if a real chain provider is being
  wired this cycle. (L1)

---

## 7. Is it safe to flip the economy live now?

**No.**

1. **There is nothing to flip and no way to un-flip it.** No economy feature flag exists
   and the core loop is ungated (C1) — going "live" just means running the server, and an
   incident would have no kill-switch.
2. **The launch tuning is inflationary.** Free seeds + a 5000/day stipend + a 13× time
   compression with no recurring sink make the economy net-positive without ceiling (C3);
   the inflation sim is expected to fail today.
3. **Faucets can be double-claimed under concurrency** (H1) and **bad config is not caught**
   (H2), so the economy is neither fully idempotent nor validated.
4. The web "forced-ON" state is **not a safe holding position** — it's the absence of
   gating (C2), contradicting the assumption that flags are protecting anything.

The spend side is solid; the gap is control, faucets, and tuning. Land **PR-1 (control
plane)** to make the economy controllable/validated/idempotent and prove the gap with
sims, then **PR-2 (owner-ratified retune + web gating)** to make the numbers safe and the
sims pass. Re-evaluate go-live only after both are green.
