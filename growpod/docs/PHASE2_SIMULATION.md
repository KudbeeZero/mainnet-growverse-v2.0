# Phase 2 — Real-Time Grow Simulation

Plants now grow, suffer, and react in real time. The engine is **compute-on-read
catch-up**: each plant stores `last_tick_at`, and whenever it's read or acted on,
it's advanced in fixed 1-hour steps up to the current time. Correctness never
depends on a background worker staying alive (ideal for Render's single web
process), and every step is deterministic — reading at any wall-clock moment
yields the same trajectory.

## Modules (`growpodempire/simulation/`)

| File | Role |
|------|------|
| `clock.py` | `Clock` protocol + `SystemClock` / `FrozenClock` (tests inject a frozen, advanceable clock). |
| `conditions.py` | `PlantCondition` + `Severity` enums — the machine-readable states a frontend renders. |
| `reactions.py` | Pure mapping from plant levels → condition flags. |
| `engine.py` | The tick loop: resource decay, pest/disease dynamics, health feedback, growth & stage advancement, event emission. |

`services/simulation_service.py` runs the engine on reads and applies player care
actions; costed actions bill through the economy ledger. Events are logged to the
`plant_events` table.

## What the plant tracks

`water_level`, `nutrient_level`, `pest_level`, `disease_level`, `health`,
`height`, `growth_stage`, and `condition_flags` (a list of `{condition,
severity}`).

## Reactions (all tunable in `data/balance.yaml → simulation`)

- **Overwatering** → `overwatered`, then `root_rot` at extreme saturation.
- **Underwatering** → `underwatered` → `wilting`.
- **Pests** → spawn stochastically (more likely in damp air / low pest-resistance
  genetics), then `pest_infestation` worsens each hour until treated.
- **Disease** → sustained high humidity breeds `mildew`; it clears slowly in dry air.
- **Nutrients** → `nutrient_burn` (overfed) / `nutrient_deficient` (starved).
- **Health** drifts toward a target set by all active stressors; sustained
  catastrophe drops it past `death_threshold` and the plant dies.

Genetics matter: `flowering_time` sets flowering length, and the hidden
`pest_resistance` / `disease_resistance` / `vigor` genes modulate susceptibility.

## API (`/api/game`)

| Method & path | Purpose |
|---------------|---------|
| `GET /players/<pid>/plants/<id>/state` | Live simulated state (runs catch-up) + recent events. |
| `GET /plants/<id>/events` | The plant's event log. |
| `POST /players/<pid>/plants/<id>/water` | Water (optional `amount`). |
| `POST /players/<pid>/plants/<id>/feed` | Feed nutrients (bills nutrient cost). |
| `POST /players/<pid>/plants/<id>/treat-pests` | Clear pests (bills treatment cost). |
| `POST /players/<pid>/plants/<id>/treat-disease` | Clear disease (bills treatment cost). |
| `POST /players/<pid>/pods/<pod_id>/environment` | Set the pod's temp/humidity/CO₂/light/pH. |

Harvesting now runs catch-up first, so **yield scales with the plant's health**
and quality reflects how it was actually grown.

## Determinism & testing

Each hourly step seeds its RNG from `(plant.id, hour)`, so the simulation is a
pure function of state + elapsed time. Tests use a `FrozenClock` and assert exact
trajectories, condition onsets, pest/disease outbreaks, care-action billing, and
plant death under total neglect.

## Next (Phase 3)

Algorand TestNet: in-game token as an ASA, rare/stabilized strains and premium
harvests minted as ARC-3 NFTs, DB-first/chain-second reconciliation.
