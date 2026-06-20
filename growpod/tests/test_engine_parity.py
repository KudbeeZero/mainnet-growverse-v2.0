"""Parity guard for the engine-pipeline refactor.

The per-hour loop now runs an ordered engine pipeline instead of calling `_step`
directly. These tests prove that refactor is behavior-preserving (the pipeline
mutates the plant and emits events identically to the original `_step`), and that
the simulation stays deterministic. Every future structural PR must keep these
green; only an owner-ratified, balance-reviewed change may move the numbers.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

from growpodempire.simulation import engine
from growpodempire.simulation.engines.base import EngineContext
from growpodempire.simulation.engines.legacy import LegacyStepEngine
from growpodempire.economy.config import get_economy_config

T0 = datetime(2026, 1, 1)


def _plant(stage="vegetative", humidity_seed="p"):
    return SimpleNamespace(
        id=humidity_seed, genome={}, growth_stage=stage,
        water_level=60.0, nutrient_level=60.0, pest_level=0.0, disease_level=0.0,
        health=100.0, height=10.0, is_alive=True, harvested=False,
        stage_entered_at=T0, condition_flags=[],
    )


def _sim():
    return get_economy_config().raw.get("simulation", {})


def _run(plant, sim, env, hours, *, pipeline):
    events, t = [], T0
    for _ in range(hours):
        t = t + timedelta(hours=1)
        rng = engine._rng_for(plant.id, t)
        if pipeline:
            ctx = EngineContext(plant=plant, env=env, sim=sim, rng=rng, t=t, auto=None)
            for eng in engine._pipeline():
                events.extend(eng.update(ctx))
        else:
            events.extend(engine._step(plant, env, sim, rng, t, None))
        if not plant.is_alive:
            break
    return events


_FIELDS = ["water_level", "nutrient_level", "pest_level", "disease_level",
           "health", "height", "growth_stage", "is_alive"]


def test_pipeline_is_the_legacy_step():
    p = engine._pipeline()
    assert [e.name for e in p] == ["legacy_step"]
    assert isinstance(p[0], LegacyStepEngine)


def test_pipeline_matches_direct_step_over_a_long_run():
    sim = _sim()
    a, b = _plant(), _plant()
    env = engine._env_for(a, None, sim)
    ea = _run(a, sim, env, 600, pipeline=False)   # original path
    eb = _run(b, sim, env, 600, pipeline=True)    # engine pipeline
    for f in _FIELDS:
        assert getattr(a, f) == getattr(b, f), f
    assert ea == eb


def test_pipeline_matches_direct_step_into_flowering():
    sim = _sim()
    a, b = _plant(stage="flowering"), _plant(stage="flowering")
    env = engine._env_for(a, None, sim)
    ea = _run(a, sim, env, 800, pipeline=False)
    eb = _run(b, sim, env, 800, pipeline=True)
    for f in _FIELDS:
        assert getattr(a, f) == getattr(b, f), f
    assert ea == eb


def test_deterministic():
    sim = _sim()
    p1, p2 = _plant(), _plant()
    env = engine._env_for(p1, None, sim)
    _run(p1, sim, env, 500, pipeline=True)
    _run(p2, sim, env, 500, pipeline=True)
    for f in _FIELDS:
        assert getattr(p1, f) == getattr(p2, f), f
