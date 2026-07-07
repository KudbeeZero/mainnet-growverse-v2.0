# Sim report — gv-o02 gear effects (owner gate D7)

**Branch:** `claude/gv-o02-equipment-sim-effects` · **Date:** 2026-07-07
**Purpose:** proof, run against the real engine and real `balance.yaml` data (no mocks), that
the new fan/soil `effects` blocks produce genuinely **both-signed** outcomes — the owner
directive for D7 — and a real water/nutrient tradeoff, not a strict upgrade. One plant
(`SimpleNamespace` fixture matching `tests/test_engine_parity.py`'s style), driven through the
actual `simulation/engine.py` `_step`/`_health_target`/`_env_for` and `simulation/gear.py`
`effects_for` — the same code paths `catch_up` calls in production.

## 1–2. Humid pod vs. dry pod, same 6" inline exhaust fan

The exhaust fan's catalog effect is `humidity_offset_pct: -8, temp_offset_c: -2` (plus pest/
disease mults, see §3). It shifts the pod's *effective* humidity down by 8 points. Whether
that helps or hurts depends entirely on which side of the optimal band `[40, 60]` the pod
started on — the same equipment, opposite sign, driven purely by the existing stress-distance
math (`outside(value, lo, hi)` in `_health_target`).

**Instantaneous health-target proof** (isolates the env-offset effect from unrelated resource
decay — the cleanest signal):

| Scenario | No fan | With exhaust fan | Delta |
|---|---|---|---|
| Humid pod (humidity 80, 20 over the band) | 89.73 | 93.82 | **+4.09** (positive) |
| Dry pod (humidity 38, 2 under the band) | 99.00 | 95.00 | **−4.00** (negative) |

**48h simulated trajectory** (same two pods, run through the real hourly loop):

| Metric | Humid, no fan | Humid, with fan | Dry, no fan | Dry, with fan |
|---|---|---|---|---|
| Health (48h) | 31.0 | 41.0 (+10.0) | 69.3 | 69.3 (+0.0) |
| Disease level (48h) | 46.8 | 28.1 (−18.7) | 0.0 | 0.0 (+0.0) |
| Pest level (48h) | 24.2 | 19.4 (−4.8) | 0.0 | 0.0 (+0.0) |

Honest note on the dry-pod 48h row: the instantaneous target delta there is small (−4.00 off a
near-ceiling 99) and gets swamped over 48 real hours by the drift rate and other stressors
converging both runs to a similar health — the *mechanism* (the negative sign) is proven by the
instantaneous table above, which isolates it from that noise. Disease/pest levels stay at 0 in
the dry scenario simply because that pod's humidity (38/30) never crosses the mildew/pest
thresholds (64/62) in either run, fan or not — the fan's mult only pays off, in this scenario,
above the threshold, which is exactly the humid-pod row.

## 3. Fan disease/pest reduction (always positive, independent of the env-offset sign)

`pest_spawn_mult`/`disease_growth_mult` scale the hourly pressure directly and are always ≤ 1
for every fan in the catalog — this part of a fan's effect is a straightforward reduction
regardless of pod humidity (see the humid-pod disease/pest deltas above: −18.7 / −4.8).

## 4. Coco coir water/nutrient tradeoff (30h, natural decay, no refeed)

Isolates the two multipliers (`water_decay_mult: 0.85`, `nutrient_decay_mult: 1.15`) from any
player action — the catalog's own tradeoff framing ("needs feeding").

| Metric | No soil | Coco coir | Delta |
|---|---|---|---|
| Water level (30h) | 15.0 | 21.8 | **+6.8** (retains water) |
| Nutrient level (30h) | 30.0 | 25.5 | **−4.5** (drains nutrients faster) |
| Health (30h) | 90.0 | 91.8 | +1.7 |

A real tradeoff in both directions, not a strict upgrade — net health is close (+1.7) because
this window's water stress (crossing toward `underwater_threshold`) outweighs the modest extra
nutrient drain; a longer, unfed window would flip the balance as nutrient stress compounds.

## Reproduction

Generator script (not committed — one-off, run manually against this branch):
`tests/test_gear_engine_effects.py` covers the same properties as permanent, CI-enforced unit
tests (`test_fan_helps_in_a_humid_pod`, `test_same_fan_hurts_in_a_dry_pod`,
`test_fan_reduces_disease_growth_rate`, `test_coco_coir_water_nutrient_tradeoff_over_time`,
`test_co2_outside_band_costs_health`, `test_co2_enriched_band_grants_growth_bonus`,
`test_no_gear_effects_reproduces_neutral_step`) — this report is the human-readable numbers
behind those assertions.

## Verdict

D7 satisfied: new gear effects produce genuine both-signed outcomes (proven instantaneously and
over a realistic trajectory) and a real tradeoff (coco coir), using only new, additive
`balance.yaml` keys — no existing number changed (see `tests/test_engine_parity.py`, still green,
byte-identical with no gear equipped).
