# 🌱 Simulation & Horticulture — the scientist-grade grow model

> The deep design for the grow simulation: every variable a serious grower or plant scientist would
> want, and how we get there from today's lean engine **without breaking the pure, compute-on-read
> contract**. Tags: ✅ built · 🔨 partial · ⬜ planned. The depth here is a primary moat (see
> `00-game-vision.md` §The Moat #1).

## First principle — the plant is a model, not a timer
The engine treats a plant as a small **physiological model**: stored inputs + elapsed time →
derived state, computed lazily on read. This is already the architecture (see ARCHITECTURE.md and
`DECISIONS.md` "Pure, compute-on-read simulation engine") and it must stay that way as we deepen it.

**Two hard constraints on all new physiology:**
1. **Purity & determinism.** Every hourly step is a pure function of state + config + a seeded RNG
   (`_rng_for(plant_id, t)` → SHA256 of plant-id + ISO hour, `simulation/engine.py:33`). Reading at
   the same wall-clock moment must yield the identical result. No player-scoped logic in the engine
   — research/skill/economy perks layer in `services/`.
2. **Cost.** Read cost is `O(elapsed hours)` (`catch_up`, `engine.py:209`), capped at
   `max_catchup_hours: 8760`. Richer per-hour math multiplies that cost. Honor the **sim-cost-cap**
   backlog item (batch/materialize dormant plants) before shipping heavy models.

---

## Where the engine is today ✅
The hourly step (`_step`, `simulation/engine.py:123`) currently models, per plant per hour:

| System | Behaviour today | Source |
|--------|-----------------|--------|
| Water | Decays `1.5/hr`; topped by pod automation; stress outside `[40, 78]` | `engine.py:136`, `balance.yaml:90` |
| Nutrients | **Single scalar**, decays `1.0/hr`; stress outside `[35, 82]` | `engine.py:137`, `balance.yaml:97` |
| Temperature | Stress outside `[20, 28]°C` | `engine.py:104`, `balance.yaml:105` |
| Humidity | Stress outside `[40, 60]%`; drives pests (≥62) + mildew (≥64) | `engine.py:109`, `balance.yaml:106` |
| pH | Stress outside `[6.0, 7.0]`, weighted ×10 ("pH swings are potent") | `engine.py:110` |
| Pests | Stochastic spawn (seeded), worsen until treated; `pest_resistance` gene modulates | `engine.py:149` |
| Disease (mildew) | Grows in damp air, clears in dry; `disease_resistance` gene modulates | `engine.py:164` |
| Health | Drifts toward a stress-derived target at `0.12/hr`; death at ≤1.0 | `engine.py:175` |
| Growth | Height cm/hr by stage, scaled by health | `engine.py:61`, `balance.yaml:141` |
| Stages | seed→germination→seedling→vegetative→flowering→harvest; durations health-modulated, flowering length is genetic | `engine.py:45`, `_STAGE_ORDER:23` |
| Conditions | 10 visible states derived each tick (overwatered, wilting, nutrient burn, pests, mildew…) | `simulation/reactions.py`, `conditions.py` |
| Curing | Post-harvest sqrt-curve quality bonus, over-dry penalty | `simulation/curing.py`, `balance.yaml:66` |
| Weather | Random events shift pod temp/humidity, then feed the sim | `services/weather_service.py`, `balance.yaml:160` |

**The honest gaps (🔨/⬜):** photoperiod is assumed, not triggered; CO₂ is inert config; nutrients
are one scalar (no EC, no N-P-K, no Ca/Mg); there is no root-zone EC/pH drift, no transpiration
model, no biomass/leaf-area, no canopy. That gap **is the opportunity** — it's where scientist-grade
depth lives. (Phase A landed: light is now read by the tick, and VPD + DLI are derived and exposed —
see `simulation/horticulture.py`.)

---

## Environment inputs a grower/scientist wants
The target variable set, each tagged. `*` marks a value that should be **derived** (cheap, high
realism) rather than independently stored.

| Variable | Why it matters | State |
|----------|----------------|-------|
| Air temperature | Metabolic rate, stress, VPD input | ✅ stress band |
| Relative humidity | Transpiration, mildew, VPD input | ✅ stress band + disease/pest triggers |
| **VPD*** (vapour-pressure deficit) | The *real* driver of transpiration & stomatal behaviour; the number serious growers actually target | ✅ derived from temp+RH+leaf-offset, feeds health + exposed in `/state` (`simulation/horticulture.py`, Phase A) |
| **PPFD** (µmol·m⁻²·s⁻¹) | Instantaneous photosynthetic light; the 0–1000 "light_intensity" scalar | ✅ now read by the tick — outside the adequate band saps health (`engine.py` `_health_target`, Phase A) |
| **DLI*** (mol·m⁻²·day⁻¹) | Daily light integral — the yield-determining light dose | ✅ derived (PPFD × photoperiod) + exposed (`horticulture.dli`); not yet a yield input |
| Light **spectrum** (blue / red / far-red / UV) | Morphology, R:FR stretch, UV→trichome response | ⬜ |
| **Photoperiod** | Triggers the veg→flower transition in photoperiod genetics; autoflower bypasses it | ⬜ (flowering is currently a fixed genetic duration) |
| **CO₂** (ppm) | Photosynthesis co-substrate; enrichment lifts the light-response ceiling | 🔨 stored + clamped, inert (`balance.yaml:170`) |
| Root-zone temperature | Uptake & root health; distinct from air temp | ⬜ |
| Substrate moisture / water activity | Already proxied by `water_level`; the real model is wet/dry-back cycles | 🔨 scalar |
| **EC / PPM** (total dissolved salts) | The master nutrient-strength dial; over/under-EC = lockout/burn | ⬜ |
| **Per-ion nutrients** (N, P, K, Ca, Mg, S, micros) | Deficiency/toxicity signatures growers diagnose by leaf symptom | ⬜ (one scalar today) |
| Root-zone **pH** | Governs *which* ions are available (lockout) — pH should gate uptake, not just sap health | 🔨 sap-health only |
| Airflow / transpiration | Couples VPD to water use and to mildew risk | ⬜ |
| Dissolved O₂ (hydro) | Root respiration / rot risk in water culture | ⬜ |

---

## Plant state a scientist wants
Today's persisted plant state (`db/models.py` Plant): `health, water_level, nutrient_level,
pest_level, disease_level, height, growth_stage, condition_flags` (+ stage timestamps, immutable
`genome`). ✅ That's a vigor-and-resources view. The scientist-grade target adds physiological state:

| State | Meaning | Tag |
|-------|---------|-----|
| Biomass / dry weight | The thing yield should actually integrate from | ⬜ |
| Leaf area / canopy index | Light interception → photosynthesis | ⬜ |
| Internode / structure | indica↔sativa morphology, stretch from R:FR | ⬜ |
| Root mass / root health | Uptake capacity, rot vulnerability | ⬜ |
| Tissue nutrient pools | Enables real deficiency/toxicity expression | ⬜ |
| Water status / turgor | Wilting as a physiological state, not a threshold | 🔨 (threshold proxy) |
| Stress ledger | Cumulative, per-factor stress with recovery — not just instantaneous | 🔨 (instantaneous target today) |
| Photosynthetic rate | The engine of growth; function of light, CO₂, temp, VPD | ⬜ |
| Cannabinoid / terpene accumulation | THC/CBD/terpene built *over flowering*, not assigned at harvest | 🔨 (terpenes expressed at harvest, `genetics/traits.py`) |

---

## Process models (the agronomy, phased)
Each is a pure per-hour function; none belongs in `services/`.

1. **Light → photosynthesis.** A light-response (DLI saturating) curve gated by CO₂ and temperature;
   feeds a biomass accumulator. Replaces "growth = flat cm/day × health" with "growth = realized
   photosynthesis." ⬜
2. **VPD → transpiration → water use.** VPD (from temp+RH) sets transpiration, which sets water draw
   and couples to mildew risk. Makes humidity a *lever*, not just a stress band. ⬜
3. **Nutrient uptake + deficiency/toxicity.** EC sets strength, pH gates ion availability, tissue
   pools fill/deplete; deficiencies surface as named conditions (Ca/Mg/N…) growers learn to read. ⬜
4. **Stress accumulation + recovery.** A per-factor ledger that *remembers* (a heat spike costs even
   after it passes, recovery takes time) rather than snapping to an instantaneous target. 🔨→⬜
5. **Stage-gated development.** Keep health-modulated durations; add photoperiod-triggered flowering
   for photoperiod genetics, and senescence late in flower. 🔨→⬜
6. **Secondary-metabolite accumulation.** THC/CBD/terpenes build along a flowering curve influenced
   by light/UV, stress, and harvest timing — so *when* you chop matters. The genome sets the ceiling
   (`02-genetics.md`); the grow decides how close you get. 🔨→⬜

---

## Cultivation methods & special equipment — deferred hooks ⬜
Explicitly **out of scope for the first passes** (per the user: "can come down the line"), but named
here so the model is designed to receive them as `balance.yaml` surfaces, not rewrites:
- **Medium:** soil · coco · hydro (DWC/RDWC) · aeroponics — each with different decay, buffering,
  and dissolved-O₂ behaviour. (Today `hydroponics`/`aeroponics` exist only as research yield buffs,
  `balance.yaml:213`.)
- **Lighting fixtures** with real spectra & efficacy (HPS / LED / CMH) → drive PPFD + spectrum.
- **Climate gear:** HVAC, dehumidifier, humidifier, CO₂ injection → drive temp/RH/VPD/CO₂ toward a
  target instead of random weather.
- Equipment ties into mastery (`03-grower-skills.md`): owning the gear isn't enough — using it well
  is a skill.

---

## Phasing — high realism first, heavy compute last
Sequenced so the biggest realism-per-cost wins land first and the cost-cap is respected.

- **Phase A — derive, don't add (cheap, high realism).** ✅ **Shipped.** VPD + DLI are derived from
  temp/RH/light + an assumed photoperiod (`simulation/horticulture.py`), the stored light scalar is
  now read by the tick (light + VPD are gentle, generously-banded health terms in `_health_target`,
  tuned in `balance.yaml` under `simulation.light` / `simulation.vpd`), and all three (VPD/DLI/PPFD)
  are exposed on `/state` via `plant_dict(..., metrics=...)`. Neutral at the optimal band, so the
  suite stayed green (147 tests). *Next within A:* let VPD modulate transpiration/mildew directly.
- **Phase B — physiology.** Photosynthesis + transpiration + a real **EC/pH→uptake** model and the
  stress ledger. Bigger per-hour cost → **land the sim-cost-cap first** (BACKLOG 🟠), profile with
  the load/soak test, then ship.
- **Phase C — spectrum, photoperiod & equipment.** Spectrum-aware morphology/metabolites,
  photoperiod-triggered flowering, and the equipment/medium surfaces above. Most content + UI work;
  build on a profiled, capped engine.

**Guardrail on every phase:** new physiology is added as a pure step, tuned via `balance.yaml`, with
property/invariant tests (e.g. "more light, all else equal, never lowers yield"; "VPD is continuous
in temp & RH") — same discipline that guards the ledger and genetics today.

---

## Cross-links
- Genes the sim should start consuming (vigor, difficulty, indica_ratio → tolerances): `02-genetics.md`.
- Mastery/equipment that gate technique: `03-grower-skills.md`.
- Invariants this must not break: `00-game-vision.md` §Anti-goals + `docs/memory/ARCHITECTURE.md`.
