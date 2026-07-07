"""Engine-level tests for equipped-gear effects (ROADMAP_90D week 2-3).

White-box, like test_engine_parity.py: exercises `_env_for`/`_health_target`/
`_step` directly with constructed env dicts, no DB — fast and pins the exact
both-signs behavior the owner directive requires (a fan's environment offset
helps when it moves the pod TOWARD the optimal band, and hurts when it moves
the pod AWAY from it).
"""

import random
from datetime import datetime, timedelta
from types import SimpleNamespace

from growpodempire.economy.config import get_economy_config
from growpodempire.simulation import engine
from growpodempire.simulation.gear import GearEffects, effects_for

T0 = datetime(2026, 1, 1)

CFG = get_economy_config()
SIM = CFG.raw["simulation"]

# The real inline-exhaust catalog entry (humidity -8, temp -2, pest/disease
# mults) — evidence this test exercises the actual shipped balance.yaml data,
# not a synthetic stand-in.
EXHAUST_EFFECTS = effects_for([{"gear_key": "inline_exhaust_6in"}], CFG.shop_gear)


def _plant():
    return SimpleNamespace(
        id="p", genome={}, growth_stage="vegetative",
        water_level=60.0, nutrient_level=60.0, pest_level=0.0, disease_level=0.0,
        health=100.0, height=10.0, is_alive=True, harvested=False,
        stage_entered_at=T0,
    )


def _health(env):
    return engine._health_target(_plant(), env, SIM)


def test_fan_helps_in_a_humid_pod():
    """A humid pod (humidity above the optimal band) is pushed TOWARD the band
    by the exhaust fan's -8 offset -> less stress -> HIGHER health target."""
    humid_env = engine._env_for(_plant(), None, SIM)
    humid_env["humidity"] = 80.0  # optimal band is [40, 60] -> 20 over

    baseline = _health(dict(humid_env))
    with_fan = engine._env_for(_plant(), None, SIM, EXHAUST_EFFECTS)
    with_fan["humidity"] = 80.0 + EXHAUST_EFFECTS.humidity_offset_pct
    boosted = _health(with_fan)

    assert boosted > baseline


def test_same_fan_hurts_in_a_dry_pod():
    """The SAME fan in an already-dry pod (humidity already below the band)
    pushes humidity further out of band -> MORE stress -> LOWER health
    target. Same equipment, opposite sign — the owner's "emergent, honest"
    requirement, not a strictly-better item."""
    dry_env = engine._env_for(_plant(), None, SIM)
    dry_env["humidity"] = 38.0  # optimal band is [40, 60] -> 2 under

    baseline = _health(dict(dry_env))
    with_fan = engine._env_for(_plant(), None, SIM, EXHAUST_EFFECTS)
    with_fan["humidity"] = 38.0 + EXHAUST_EFFECTS.humidity_offset_pct
    hurt = _health(with_fan)

    assert hurt < baseline


def test_fan_reduces_disease_growth_rate():
    """disease_growth_mult scales the hourly mildew-growth rate directly —
    always a reduction for a fan (independent of the two-signed env effect
    above), matching the catalog's disease_growth_mult < 1.0."""
    humid_env = engine._env_for(_plant(), None, SIM)
    humid_env["humidity"] = 90.0  # above disease.humidity_threshold (64)

    p_no_fan = _plant()
    engine._step(p_no_fan, humid_env, SIM, random.Random(1), T0 + timedelta(hours=1))

    p_fan = _plant()
    engine._step(
        p_fan, humid_env, SIM, random.Random(1), T0 + timedelta(hours=1),
        None, EXHAUST_EFFECTS,
    )

    assert p_fan.disease_level < p_no_fan.disease_level


def test_coco_coir_water_nutrient_tradeoff_over_time():
    """coco_coir: slower water drain, faster nutrient drain — a real tradeoff,
    not a strict upgrade, verified by actually running `_step`."""
    coco_effects = effects_for([{"gear_key": "coco_coir"}], CFG.shop_gear)
    env = engine._env_for(_plant(), None, SIM)

    baseline = _plant()
    coco = _plant()
    for h in range(10):
        t = T0 + timedelta(hours=h + 1)
        engine._step(baseline, env, SIM, random.Random(h), t)
        engine._step(coco, env, SIM, random.Random(h), t, None, coco_effects)

    assert coco.water_level > baseline.water_level       # drains slower
    assert coco.nutrient_level < baseline.nutrient_level  # drains faster


def test_no_gear_effects_reproduces_neutral_step():
    """effects=None and effects=GearEffects() (the neutral default) must
    behave identically — the explicit form of the parity guarantee."""
    env = engine._env_for(_plant(), None, SIM)
    a, b = _plant(), _plant()
    for h in range(20):
        t = T0 + timedelta(hours=h + 1)
        engine._step(a, env, SIM, random.Random(h), t, None, None)
        engine._step(b, env, SIM, random.Random(h), t, None, GearEffects())
    for field in ("water_level", "nutrient_level", "pest_level", "disease_level", "health", "height"):
        assert getattr(a, field) == getattr(b, field)


def test_co2_outside_band_costs_health():
    env_in_band = engine._env_for(_plant(), None, SIM)
    env_low = dict(env_in_band, co2=200.0)   # below optimal_ppm [400, 1400]
    assert _health(env_low) < _health(env_in_band)


def test_co2_enriched_band_grants_growth_bonus():
    """Enriched CO2 (inside the tighter `enriched_ppm` sweet spot) grows
    faster than the unsensored default (800 ppm — deliberately below the
    sweet spot, so this bonus is earned, not free) — same health, same
    inputs, different height after one hour."""
    plant_default = _plant()
    plant_enriched = _plant()
    env_default = engine._env_for(_plant(), None, SIM)          # co2 = 800 default
    env_enriched = dict(env_default, co2=1000.0)                 # inside [900, 1200]

    t = T0 + timedelta(hours=1)
    engine._step(plant_default, env_default, SIM, random.Random(5), t)
    engine._step(plant_enriched, env_enriched, SIM, random.Random(5), t)

    assert plant_enriched.height > plant_default.height
