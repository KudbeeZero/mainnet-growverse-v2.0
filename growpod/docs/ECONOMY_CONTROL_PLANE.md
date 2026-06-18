# Economy Control Plane (PR-1) — safety scaffold

This is the first of two economy-readiness PRs scoped from the
[Economy Readiness Audit](audits/ECONOMY_READINESS_AUDIT.md). It is **safety-only**:
it makes the economy controllable, validated, and honestly documented **without
changing any tuning value and without taking the economy live.**

## Handoff statements (read these first)

- **Current behavior is preserved.** No route response, price, reward, or balance
  changes for any existing flow. The full suite stays green.
- **No tuning was changed.** Every value in `src/growpodempire/data/balance.yaml`
  is byte-for-byte unchanged (`seeds.base_cost: 0`, `daily_stipend: 5000`,
  `time_scale`, all multipliers, etc.).
- **The economy remains in free-playtest mode.** Seeds are still free; the playtest
  baseline is intact.
- **The new `economy` flag defaults ON only to avoid any behavior change.** Default
  ON means "the economy system runs exactly as it does today." It is **NOT**
  live-economy approval.
- **Live economy is still BLOCKED** until the simulation + exploit hardening lands
  (PR-2 and the required sims in the audit). Going live is a separate,
  owner-approved step.

## What shipped in PR-1

### 1. Canonical config path + validation
- `economy/config.py` now validates `balance.yaml` on load via
  `validate_economy_config()` (raises `EconomyConfigError`).
- Validation guards only **corrupting** states — negative economy amounts (a
  negative cost would invert a sink into a faucet), non-finite numbers (NaN/inf),
  bad `currency.decimals`, and market fee fractions outside `[0, 1]`.
- It **accepts** all current free-playtest values; **zero is a valid price**, not a
  failure. Final balance is owner-ratified, never decided by validation.
- Tests: `tests/test_economy_config.py`.

### 2. Economy master kill-switch (`economy` feature flag)
- New `economy: true` flag in `balance.yaml` `feature_flags:`.
- Gates the core money loop (the routes the audit found ungated): seed buy, pod
  buy/upgrade, breed, stabilize, harvest, cleanup, finish-cure(sell), sell, research
  unlock, shop buy, apply consumable, care (water/feed/treat), auto-care, daily
  stipend, achievement claim — via `@require_feature("economy")` (gate precedes
  auth, like the marketplace gate).
- **Default ON ⇒ zero behavior change.** `FEATURE_ECONOMY=false` freezes all GROW
  movement in an incident, no deploy required (the kill-switch the audit's C1 found
  missing). Peripheral economy surfaces (marketplace, cup, university, contracts,
  chain) keep their own existing flags.
- Tests: `tests/test_feature_flags.py` (unit), `tests/test_feature_gates.py`
  (route ON/OFF/default + gate-before-auth + `/flags` agreement).

### 3. De-hardcoded economy tests (canonicalization)
- Six previously-failing tests had hardcoded the **pre-playtest** balance values
  (seed 25, stipend 50, an old rarity-multiplier table). They now derive expected
  values from the canonical config, so they pass at the current tuning **and** will
  still pass after the owner-ratified retune in PR-2 — no more drift between tests
  and `balance.yaml`. Files: `tests/test_economy.py`, `tests/test_game_service.py`,
  `tests/test_progression.py`, `tests/test_properties.py`.

## Explicitly NOT in PR-1 (deferred / out of scope)
- No `balance.yaml` value changes; no player-facing balance changes.
- No economy go-live; the flag default is ON to preserve current behavior only.
- No DB idempotency constraints, no simulation/exploit tests, no web flag restore —
  those are PR-2 / the audit's required-hardening list.
- No coverage backfill beyond what economy safety required (the drifted tests).
- No gameplay expansion; PR #8 untouched.

## Path to live (separate, owner-approved)
Per the audit: land this control plane → add the live-blocking simulation +
exploit tests (which are expected to FAIL on the current inflationary config, by
design) → **owner-ratified `balance.yaml` retune** so those sims pass → then, and
only then, a tiny owner-approved config change flips to the live economy. See
[ECONOMY_READINESS_AUDIT.md](audits/ECONOMY_READINESS_AUDIT.md) §5–§7.
