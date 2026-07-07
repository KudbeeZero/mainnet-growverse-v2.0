"""
The deterministic, compute-on-read simulation engine.

`catch_up(session, plant, now, cfg)` advances a plant in fixed 1-hour steps from
its `last_tick_at` up to `now`, mutating its resource levels, health, growth, and
stage, and emitting PlantEvent rows for stage changes, condition onsets, and
death. Each hourly step seeds its RNG from (plant id, hour) so the trajectory is
a pure function of state + elapsed time — reading at any wall-clock moment yields
the same result (idempotent).
"""

import hashlib
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from ..enums import GrowthStage
from ..db.models import Plant, GrowPod, GearInventory, PlantEvent
from . import reactions, horticulture
from . import gear as gear_sim
from .conditions import PlantCondition
from .engines.base import EngineContext
from .gear import GearEffects

# The per-hour engine pipeline. Built lazily so `engines.legacy` (which imports
# `_step` from this module) can be imported without a cycle. Parity-first: the
# only stage today is the LegacyStepEngine wrapping `_step`, so the pipeline
# reproduces the original behavior exactly. Real micro-engines are inserted here.
_PIPELINE = None


def _pipeline():
    global _PIPELINE
    if _PIPELINE is None:
        from .engines.legacy import LegacyStepEngine
        _PIPELINE = [LegacyStepEngine()]
    return _PIPELINE

# Stages that actually grow / take time, in order.
_STAGE_ORDER = [
    GrowthStage.SEED,
    GrowthStage.GERMINATION,
    GrowthStage.SEEDLING,
    GrowthStage.VEGETATIVE,
    GrowthStage.FLOWERING,
    GrowthStage.LATE_FLOWER,
    GrowthStage.HARVEST,
]


def _rng_for(plant_id: str, t: datetime) -> random.Random:
    """A stable RNG for a given plant-hour (makes catch-up reproducible)."""
    key = f"{plant_id}:{t.isoformat()}".encode("utf-8")
    seed = int(hashlib.sha256(key).hexdigest()[:12], 16)
    return random.Random(seed)


def _gene(plant: Plant, trait: str, default: float = 0.5) -> float:
    gene = (plant.genome or {}).get(trait)
    return float(gene["value"]) if gene else default


def _stage_duration_hours(plant: Plant, stage: GrowthStage, sim: Dict) -> float:
    stages = sim.get("stages", {})
    if stage == GrowthStage.SEED:
        base = stages.get("seed_days", 3) * 24
    elif stage == GrowthStage.GERMINATION:
        base = stages.get("germination_days", 5) * 24
    elif stage == GrowthStage.SEEDLING:
        base = stages.get("seedling_days", 10) * 24
    elif stage == GrowthStage.VEGETATIVE:
        base = stages.get("vegetative_days", 26) * 24
    elif stage == GrowthStage.FLOWERING:
        # Flowering length is genetic.
        base = _gene(plant, "flowering_time", 60) * 24
    elif stage == GrowthStage.LATE_FLOWER:
        # Ripening/finish — an additive block appended after flowering (a fixed
        # number of days, NOT carved out of the genetic flowering window), so it
        # lengthens total seed->harvest time by `late_flower_days` (× time_scale).
        # Player-facing pacing change, owner-ratified (see DECISIONS 2026-06-18).
        base = stages.get("late_flower_days", 14) * 24
    else:
        return 0.0
    # Launch pacing: a single global multiplier compresses (or expands) the whole
    # lifecycle uniformly — pre-flower knobs *and* the genetic flowering window —
    # so new players reach buds/frost/harvest inside their first days without
    # touching genetics or the economy's *rates*. 1.0 = canonical real-time pace;
    # set <1 in balance.yaml for a compressed launch. Relative stage proportions
    # and per-strain flowering differences are preserved.
    return base * float(sim.get("time_scale", 1.0))


def stage_forecast(plant: Plant, cfg, now: datetime) -> Dict:
    """A pure, deterministic read of where a plant is in its lifecycle and when
    it will reach the next stage and harvest-readiness.

    The transition rule mirrors `_step`: a stage takes ``base * (1 + (100 - health)
    / 200)`` hours, so poor health stretches it. ETAs assume the *current* health
    holds — the UI should present them as estimates that better care improves and
    stress delays. Times are absolute ISO strings so a client countdown stays
    accurate between polls.
    """
    sim = cfg.raw.get("simulation", {})
    stage = GrowthStage(plant.growth_stage)
    idx = _STAGE_ORDER.index(stage)

    def _effective(s: GrowthStage) -> float:
        base = _stage_duration_hours(plant, s, sim)
        return base * (1.0 + (100.0 - plant.health) / 200.0)

    age_hours = None
    if plant.planted_at is not None:
        age_hours = round(max(0.0, (now - plant.planted_at).total_seconds() / 3600.0), 1)
    hours_in_stage = 0.0
    if plant.stage_entered_at is not None:
        hours_in_stage = max(0.0, (now - plant.stage_entered_at).total_seconds() / 3600.0)

    out = {
        "stage": stage.value,
        "stage_index": idx,
        "stage_count": len(_STAGE_ORDER),
        "age_hours": age_hours,
        "hours_in_stage": round(hours_in_stage, 1),
    }

    # HARVEST is the terminal, harvest-ready state — no further countdown.
    if stage == GrowthStage.HARVEST:
        out.update({
            "next_stage": None,
            "stage_progress_pct": 100.0,
            "stage_base_hours": 0.0,
            "stage_total_hours": 0.0,
            "next_stage_eta": None,
            "hours_to_harvest": 0.0,
            "harvest_eta": None,
            "is_harvest_ready": True,
        })
        return out

    base = _stage_duration_hours(plant, stage, sim)
    effective = _effective(stage)
    progress = min(100.0, (hours_in_stage / effective) * 100.0) if effective > 0 else 100.0
    remaining_in_stage = max(0.0, effective - hours_in_stage)

    # Time to harvest-ready = remaining in this stage + full (current-health)
    # durations of every stage up to (but excluding) HARVEST.
    hours_to_harvest = remaining_in_stage
    for s in _STAGE_ORDER[idx + 1:]:
        if s == GrowthStage.HARVEST:
            break
        hours_to_harvest += _effective(s)

    out.update({
        "next_stage": _STAGE_ORDER[idx + 1].value,
        "stage_progress_pct": round(progress, 1),
        "stage_base_hours": round(base, 1),
        "stage_total_hours": round(effective, 1),
        "next_stage_eta": (now + timedelta(hours=remaining_in_stage)).isoformat(),
        "hours_to_harvest": round(hours_to_harvest, 1),
        "harvest_eta": (now + timedelta(hours=hours_to_harvest)).isoformat(),
        "is_harvest_ready": False,
    })
    return out


def _growth_cm_per_hour(stage: GrowthStage, sim: Dict, health: float) -> float:
    growth = sim.get("growth", {})
    rate = {
        GrowthStage.SEEDLING: growth.get("seedling_cm_per_day", 0.6),
        GrowthStage.VEGETATIVE: growth.get("vegetative_cm_per_day", 2.2),
        GrowthStage.FLOWERING: growth.get("flowering_cm_per_day", 0.5),
        # Late flower is the ripening finish — buds fatten but vertical growth
        # all but stops, so the slowest rate of the cycle.
        GrowthStage.LATE_FLOWER: growth.get("late_flower_cm_per_day", 0.2),
    }.get(stage, 0.0)
    return rate / 24.0 * (health / 100.0)


def _env_for(
    plant: Plant, pod: Optional[GrowPod], sim: Dict, effects: Optional[GearEffects] = None
) -> Dict:
    defaults = sim.get("environment", {}).get("defaults", {})
    light_default = defaults.get("light_intensity", 600)
    co2_default = defaults.get("co2_level", 800)
    if pod is not None and pod.temperature is not None:
        env = {
            "temperature": pod.temperature,
            "humidity": pod.humidity,
            "ph_level": pod.ph_level if pod.ph_level is not None else defaults.get("ph_level", 6.5),
            "light": pod.light_intensity if pod.light_intensity is not None else light_default,
            "co2": pod.co2_level if pod.co2_level is not None else co2_default,
        }
    else:
        env = {
            "temperature": defaults.get("temperature", 24),
            "humidity": defaults.get("humidity", 50),
            "ph_level": defaults.get("ph_level", 6.5),
            "light": light_default,
            "co2": co2_default,
        }
    # Equipped-gear offsets (fans) shift the EFFECTIVE environment the health
    # math scores below — the same fan helps in a humid pod and hurts in a dry
    # one, since it's the offset environment's distance from the optimal band
    # that drives stress, not the offset itself. `environment_for` (the public,
    # display-facing wrapper) never passes `effects`, so the raw sensor reading
    # shown to players is unaffected.
    if effects is not None:
        env["temperature"] += effects.temp_offset_c
        env["humidity"] += effects.humidity_offset_pct
    return env


def environment_for(plant: Plant, pod: Optional[GrowPod], sim: Dict) -> Dict:
    """Public view of a plant's current environment (temp/humidity/pH/light).

    Deliberately omits equipped-gear offsets — this is the raw sensor reading
    a player set, not the gear-adjusted value the engine scores internally.
    """
    return _env_for(plant, pod, sim)


def _health_target(plant: Plant, env: Dict, sim: Dict) -> float:
    h = sim.get("health", {})
    water = sim.get("water", {})
    nutrient = sim.get("nutrient", {})
    envcfg = sim.get("environment", {})

    def outside(value, lo, hi):
        return max(0.0, lo - value, value - hi)

    water_stress = outside(
        plant.water_level, water.get("optimal_low", 40), water.get("optimal_high", 78)
    )
    nutrient_stress = outside(
        plant.nutrient_level,
        nutrient.get("optimal_low", 35),
        nutrient.get("optimal_high", 82),
    )

    t_lo, t_hi = envcfg.get("temperature", [20, 28])
    h_lo, h_hi = envcfg.get("humidity", [40, 60])
    p_lo, p_hi = envcfg.get("ph_level", [6.0, 7.0])
    env_stress = (
        outside(env["temperature"], t_lo, t_hi)
        + outside(env["humidity"], h_lo, h_hi)
        + outside(env["ph_level"], p_lo, p_hi) * 10.0  # pH swings are potent
    )

    # Light & VPD (Phase A): the engine now reads the pod's light level and the
    # derived leaf vapour-pressure deficit. Bands are generous and the weights
    # modest — adequate light + in-band VPD contribute no penalty.
    lightcfg = sim.get("light", {})
    vpdcfg = sim.get("vpd", {})
    l_lo, l_hi = lightcfg.get("optimal_ppfd", [300, 900])
    light_stress = outside(env.get("light", (l_lo + l_hi) / 2.0), l_lo, l_hi)
    v_lo, v_hi = vpdcfg.get("optimal", [0.8, 1.6])
    vpd = horticulture.vpd_kpa(
        env["temperature"], env["humidity"], vpdcfg.get("leaf_offset_c", 2.0)
    )
    vpd_stress = outside(vpd, v_lo, v_hi)

    # CO2 (E1 fix): was a decorative sensor — now outside the optimal band
    # saps health like any other stressor. Weight is modest by design.
    co2cfg = sim.get("co2", {})
    c_lo, c_hi = co2cfg.get("optimal_ppm", [400, 1400])
    co2_stress = outside(env.get("co2", (c_lo + c_hi) / 2.0), c_lo, c_hi)

    penalty = (
        water_stress * h.get("water_stress_weight", 0.6)
        + nutrient_stress * h.get("nutrient_stress_weight", 0.5)
        + env_stress * h.get("env_stress_weight", 0.5)
        + light_stress * h.get("light_stress_weight", 0.02)
        + vpd_stress * h.get("vpd_stress_weight", 0.5)
        + co2_stress * co2cfg.get("stress_weight", 0.15)
        + plant.pest_level * h.get("pest_weight", 0.45)
        + plant.disease_level * h.get("disease_weight", 0.55)
    )
    return max(0.0, min(100.0, 100.0 - penalty))


def _step(
    plant: Plant,
    env: Dict,
    sim: Dict,
    rng: random.Random,
    t: datetime,
    auto: Optional[Dict] = None,
    effects: Optional[GearEffects] = None,
) -> List[dict]:
    """Advance the plant by one simulated hour. Returns stage/death events."""
    events: List[dict] = []
    decay = sim.get("resource_decay", {})
    fx = effects if effects is not None else GearEffects()

    # 1. Resources dry out / deplete (soils scale the drain rate).
    plant.water_level = max(
        0.0, plant.water_level - decay.get("water_per_hour", 1.5) * fx.water_decay_mult
    )
    plant.nutrient_level = max(
        0.0,
        plant.nutrient_level - decay.get("nutrient_per_hour", 1.0) * fx.nutrient_decay_mult,
    )

    # 1b. Pod automation tops resources back up when they run low.
    if auto:
        autocfg = sim.get("automation", {})
        if auto.get("water") and plant.water_level < autocfg.get("water_refill_below", 45):
            plant.water_level = autocfg.get("water_refill_to", 72)
        if auto.get("feed") and plant.nutrient_level < autocfg.get("nutrient_refill_below", 40):
            plant.nutrient_level = autocfg.get("nutrient_refill_to", 72)

    # 2. Pests: spawn when absent, otherwise worsen until treated (fans scale
    #    the spawn chance — see GearEffects.pest_spawn_mult).
    pests = sim.get("pests", {})
    pest_res = _gene(plant, "pest_resistance", 0.5)
    if plant.pest_level <= 0:
        chance = pests.get("base_spawn_chance_per_hour", 0.012)
        if env["humidity"] >= pests.get("humidity_high", 62):
            chance += pests.get("humidity_spawn_bonus", 0.03)
        chance *= (1.0 - 0.5 * pest_res) * fx.pest_spawn_mult
        if rng.random() < chance:
            plant.pest_level = 5.0
    else:
        plant.pest_level = min(
            100.0,
            plant.pest_level
            + pests.get("growth_per_hour", 1.6) * (1.0 - 0.5 * pest_res) * fx.pest_spawn_mult,
        )

    # 3. Disease (mildew): grows in damp air, slowly clears in dry air (fans
    #    scale the growth rate — see GearEffects.disease_growth_mult).
    disease = sim.get("disease", {})
    dis_res = _gene(plant, "disease_resistance", 0.5)
    if env["humidity"] >= disease.get("humidity_threshold", 64):
        plant.disease_level = min(
            100.0,
            plant.disease_level
            + disease.get("growth_per_hour", 1.3) * (1.0 - 0.5 * dis_res) * fx.disease_growth_mult,
        )
    else:
        plant.disease_level = max(0.0, plant.disease_level - 0.5)

    # 4. Health drifts toward the target dictated by current stressors.
    target = _health_target(plant, env, sim)
    hcfg = sim.get("health", {})
    drift = hcfg.get("drift_rate", 0.12)
    plant.health = max(0.0, min(100.0, plant.health + (target - plant.health) * drift))

    if plant.health <= hcfg.get("death_threshold", 1.0):
        plant.health = 0.0
        plant.is_alive = False
        events.append({"type": "death", "severity": "severe", "payload": {}})
        return events

    # 5. Growth & stage advancement. Enriched CO2 (inside the tighter
    #    `enriched_ppm` band, above the unsensored default) earns a small,
    #    EARNED growth-rate bonus — see the co2 block's comment in balance.yaml.
    stage = GrowthStage(plant.growth_stage)
    if stage != GrowthStage.HARVEST:
        co2cfg = sim.get("co2", {})
        e_lo, e_hi = co2cfg.get("enriched_ppm", [900, 1200])
        co2_enriched = e_lo <= env.get("co2", 0) <= e_hi
        growth_mult = 1.0 + (co2cfg.get("enriched_growth_bonus_pct", 0.05) if co2_enriched else 0.0)
        plant.height += _growth_cm_per_hour(stage, sim, plant.health) * growth_mult
        base = _stage_duration_hours(plant, stage, sim)
        # Poor health slows development.
        effective = base * (1.0 + (100.0 - plant.health) / 200.0)
        hours_in_stage = (t - plant.stage_entered_at).total_seconds() / 3600.0
        if base > 0 and hours_in_stage >= effective:
            nxt = _STAGE_ORDER[_STAGE_ORDER.index(stage) + 1]
            plant.growth_stage = nxt.value
            plant.stage_entered_at = t
            events.append(
                {
                    "type": "stage_change",
                    "severity": None,
                    "payload": {"from": stage.value, "to": nxt.value},
                }
            )
    return events


def catch_up(session, plant: Plant, now: datetime, cfg) -> List[PlantEvent]:
    """Advance `plant` to `now`, persisting events. Returns the new events."""
    sim = cfg.raw.get("simulation", {})
    emitted: List[PlantEvent] = []

    if plant.harvested or not plant.is_alive:
        plant.last_tick_at = now
        plant.condition_flags = reactions.compute_conditions(plant, sim)
        return emitted

    pod = session.get(GrowPod, plant.pod_id)

    # Equipped gear (fans/soils) merges into a GearEffects that shifts the
    # effective environment + hourly rates below. No gear equipped -> the
    # neutral default -> byte-identical to the pre-gear-effects engine
    # (see tests/test_engine_parity.py).
    equipped = []
    if pod is not None:
        equipped = [
            {"gear_key": row.gear_key}
            for row in session.query(GearInventory).filter(
                GearInventory.equipped_pod_id == pod.id
            )
        ]
    effects = gear_sim.effects_for(equipped, cfg.shop_gear)

    env = _env_for(plant, pod, sim, effects)
    auto = {
        "water": bool(pod and pod.auto_water),
        "feed": bool(pod and pod.auto_feed),
    }

    elapsed_hours = int((now - plant.last_tick_at).total_seconds() // 3600)
    raw_elapsed = max(0, elapsed_hours)
    cap = int(sim.get("max_catchup_hours", 8760))
    elapsed_hours = min(raw_elapsed, cap)

    prev_conditions = {f["condition"] for f in (plant.condition_flags or [])}

    for _ in range(elapsed_hours):
        t = plant.last_tick_at + timedelta(hours=1)
        rng = _rng_for(plant.id, t)
        # Thin orchestrator: run the engine pipeline for this hour. (Today that is
        # the single LegacyStepEngine, so behavior is identical to calling _step.)
        ctx = EngineContext(plant=plant, env=env, sim=sim, rng=rng, t=t, auto=auto, effects=effects)
        step_events: List[dict] = []
        for engine in _pipeline():
            step_events.extend(engine.update(ctx))
        plant.last_tick_at = t

        for ev in step_events:
            emitted.append(_record_event(session, plant, t, ev["type"], ev.get("severity"), ev.get("payload", {})))

        # Detect newly-appeared conditions and log their onset.
        conditions = reactions.compute_conditions(plant, sim)
        names = {f["condition"] for f in conditions}
        for f in conditions:
            cond = f["condition"]
            if cond not in prev_conditions and cond != PlantCondition.HEALTHY.value:
                emitted.append(
                    _record_event(session, plant, t, "condition_onset", f["severity"], {"condition": cond})
                )
        prev_conditions = names

        if not plant.is_alive:
            break

    # Dormancy: an absence longer than the cap simulates only the first
    # `cap` hours, then pauses the plant through the rest of the gap (the
    # stage clock shifts with it) and lands at `now`. This bounds every
    # read at one cap window — without it a capped plant stays behind
    # `now` and each subsequent read pays the full cap again. The skip is
    # recorded as an auditable event.
    if plant.is_alive and raw_elapsed > cap:
        skipped = raw_elapsed - cap
        plant.last_tick_at += timedelta(hours=skipped)
        plant.stage_entered_at += timedelta(hours=skipped)
        emitted.append(
            _record_event(
                session, plant, plant.last_tick_at, "dormancy", None,
                {"skipped_hours": skipped},
            )
        )

    plant.condition_flags = reactions.compute_conditions(plant, sim)
    return emitted


def advance_to(session, plant: Plant, when, cfg) -> List[PlantEvent]:
    """Convenience wrapper accepting a datetime or a Clock."""
    now = when.now() if hasattr(when, "now") else when
    return catch_up(session, plant, now, cfg)


def _record_event(session, plant, t, event_type, severity, payload) -> PlantEvent:
    ev = PlantEvent(
        plant_id=plant.id,
        timestamp=t,
        event_type=event_type,
        severity=severity,
        payload=payload,
    )
    session.add(ev)
    return ev
