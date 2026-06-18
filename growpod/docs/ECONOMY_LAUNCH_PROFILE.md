# Economy Launch Profile + Simulation Results (PR-2)

The second economy-readiness PR (after the [Control Plane](ECONOMY_CONTROL_PLANE.md)).
It introduces the **owner-ratified launch economy as a separate profile**, the
**simulations** that validate it, and the **web feature-flag restore** — without
taking the economy live. Live remains owner-gated.

## 1. Two economy profiles (kept separate so test values can't ship)

Selected by `ECONOMY_PROFILE` (default `playtest`):

| | `playtest` (default) | `launch` |
|---|---|---|
| seeds.base_cost | 0 (free) | **25** |
| daily_stipend | 5000 | **50** |
| simulation.time_scale | 0.075 (≈13× fast) | **1.0** (real-time) |
| Source | `balance.yaml` as-is | `balance.yaml` + `balance.launch.yaml` overlay |
| Use | testing / free playtest | live / mainnet |

The launch values are the **owner-ratified** ones, applied only in the
`balance.launch.yaml` overlay — the free-playtest `balance.yaml` is unchanged, so
the two economies stay isolated.

### Launch guards (so temporary test values cannot accidentally ship)
`validate_launch_profile()` runs on load for the launch profile and **refuses to
boot** unless: `seeds.base_cost >= 25`, `daily_stipend <= 50`, `time_scale == 1.0`.
Additionally, **production refuses any profile but `launch`** (`load_economy_config`
raises if `APP_ENV=production` and `ECONOMY_PROFILE != launch`). Tests:
`tests/test_economy_config.py`.

## 2. Simulation results

Driven end-to-end over the HTTP API (seed → grow → harvest → sell + a daily-stipend
claim), fast-forwarded with the dev clock, per profile. Source:
`tests/test_economy_sim.py` (`pytest -m sim -s`). One active player, one full grow
cycle:

| metric | playtest | launch |
|---|---:|---:|
| grow days (to flower) | 4 | 57 |
| harvest sale (faucet) | 1054 | 812 |
| faucet_total | 6554 | 1362 |
| sink_total | 120 | 410 |
| **net issuance** | **6434** | **952** |
| net issuance / day | 1608 | 17 |
| sink / faucet ratio | 0.018 | 0.296 |
| ledger reconciled | ✅ | ✅ |

**Read:** the launch retune cuts per-cycle net issuance ~6.8× (6434 → 952) and
raises the sink-to-faucet ratio ~16× (1.8% → 30%) — seeds are no longer free and
the stipend is no longer a wealth pump. The ledger reconciles under both. No single
harvest mints a runaway amount (sale bounded < 5000). Adversarial checks pass:
daily-stipend faucet is idempotent within a cooldown (no double-claim), a harvest
can't be sold twice, and negative/oversized inputs are rejected.

> **Caveat (and a recommended delta):** the daily-stipend cooldown is keyed to
> **wall-clock** time, not the dev/sim clock, so each sim run claims the stipend
> only once regardless of simulated days. The *recurring* stipend faucet is
> therefore compared analytically: **launch 50/day vs playtest 5000/day — a 100×
> reduction**. Making the stipend cooldown clock-aware would let the recurring
> faucet be load-tested via fast-forward (see deltas below).

## 3. Recommended retune deltas BEFORE final live approval (owner-ratified)

The three ratified values are applied and pass the guards. The following are
**recommended** (NOT applied here — they are player-facing economy changes needing
owner sign-off) before flipping live:

1. **Bound Cup prizes by the collected entry-fee pool** (audit H3) — currently a
   fixed payout that can exceed fees, i.e. a net faucet leak.
2. **Add a mint sink (or formally treat mint as the intended sink)** (audit M3) —
   minting currently costs no GROW yet `first_nft` pays 250.
3. **Confirm an absolute harvest-payout cap** — sims show bounded sales at `rare`
   (~800–1050), but the `legendary` 8× multiplier stacks with THC/terpene/quality;
   verify a ceiling before live.
4. **Make the daily-stipend cooldown clock-aware** — removes wall-clock coupling
   and makes the recurring faucet load-testable via the sim clock.
5. **DB-level faucet idempotency** (audit H1) — add unique constraints for the
   stipend/achievement faucets (a hardening step; the app-level guard holds today
   but lacks a concurrency backstop).

Items 1–3 affect tuning/payout and need owner ratification; 4–5 are hardening.

## 4. Web feature-flag restore

`web/src/lib/features.ts` no longer hardcodes flags ON. `computeFeatures(env)` is
restored and wired to `FEATURES`, mirroring the backend polarity: **ON by default**
(so the testing build still shows every screen — current behavior preserved),
disabled per-environment with `NEXT_PUBLIC_ENABLE_<NAME>=false` for launch. Test:
`web/src/lib/__tests__/features.test.ts` (updated to the restored polarity).
*Note:* the web test runner (vitest) is not installed in this environment (no
network), so the web test is corrected but executed by CI on `npm i`.

## 5. Path to live (still owner-gated — NOT done here)
1. ✅ Control plane (PR-1) + ✅ launch profile + sims + web restore (PR-2, this PR).
2. Owner reviews sim results + ratifies the recommended deltas (§3).
3. A tiny, owner-approved change sets the live deployment to `ECONOMY_PROFILE=launch`
   (production already refuses anything else) — that is the go-live flip.
4. Final owner approval. **The economy is NOT live until step 3–4 happen.**
