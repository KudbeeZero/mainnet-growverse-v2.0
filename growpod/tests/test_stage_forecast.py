"""Lifecycle forecast: stage progress + ETAs to the next stage and harvest.

The forecast is a pure read over the same transition rule the engine uses in
`_step` (a stage takes ``base * (1 + (100 - health)/200)`` hours), so it must be
deterministic and consistent with how the plant actually advances.
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.enums import GrowthStage
from growpodempire.services.simulation_service import SimulationService
from growpodempire.simulation import engine
from growpodempire.simulation.clock import FrozenClock

from test_simulation import _plant, BASE, CFG


def test_seed_start_has_full_remaining_lifecycle(session):
    _, _, plant = _plant(session)
    plant.health = 100.0
    session.flush()
    f = engine.stage_forecast(plant, CFG, BASE)
    assert f["stage"] == GrowthStage.SEED.value
    assert f["stage_index"] == 0
    assert f["stage_count"] == 6
    assert f["next_stage"] == GrowthStage.GERMINATION.value
    assert f["stage_progress_pct"] == 0.0
    assert f["is_harvest_ready"] is False
    # seed_days (3) * 24h at full health, scaled by the launch pacing multiplier
    # (the engine rounds the reported hours to 0.1).
    scale = float(CFG.raw["simulation"].get("time_scale", 1.0))
    assert f["stage_base_hours"] == round(72.0 * scale, 1)
    assert f["stage_total_hours"] == round(72.0 * scale, 1)
    # Harvest is the whole lifecycle out: the fixed pre-flower stages
    # (72+120+240+624) plus flowering, all under the same pacing scale.
    assert f["hours_to_harvest"] > 1056 * scale
    eta = datetime.fromisoformat(f["harvest_eta"])
    assert abs((eta - BASE).total_seconds() / 3600.0 - f["hours_to_harvest"]) < 0.1


def test_progress_advances_and_eta_shrinks_over_time(session):
    _, _, plant = _plant(session)
    plant.health = 100.0
    session.flush()
    # Sample two moments *within* the seed stage (its length scales with the
    # launch pacing knob, so derive the deltas from it rather than hardcoding).
    scale = float(CFG.raw["simulation"].get("time_scale", 1.0))
    seed_h = 72.0 * scale
    early = engine.stage_forecast(plant, CFG, BASE + timedelta(hours=seed_h * 0.2))
    later = engine.stage_forecast(plant, CFG, BASE + timedelta(hours=seed_h * 0.6))
    assert 0 < early["stage_progress_pct"] < later["stage_progress_pct"]
    assert early["hours_to_harvest"] > later["hours_to_harvest"]
    # next-stage ETA is a fixed wall-clock moment, not a sliding window.
    assert early["next_stage_eta"] == later["next_stage_eta"]


def test_poor_health_stretches_durations(session):
    _, _, plant = _plant(session)
    plant.health = 100.0
    session.flush()
    healthy = engine.stage_forecast(plant, CFG, BASE)
    plant.health = 50.0
    session.flush()
    sick = engine.stage_forecast(plant, CFG, BASE)
    # health 50 -> multiplier 1.25 on every stage (reported hours are rounded to
    # 0.1, so compare within that tolerance rather than exactly).
    assert sick["stage_total_hours"] == pytest.approx(
        healthy["stage_total_hours"] * 1.25, abs=0.1
    )
    assert sick["hours_to_harvest"] > healthy["hours_to_harvest"]
    # base (ideal) duration is unaffected by health.
    assert sick["stage_base_hours"] == healthy["stage_base_hours"]


def test_harvest_stage_is_terminal(session):
    _, _, plant = _plant(session)
    plant.growth_stage = GrowthStage.HARVEST.value
    session.flush()
    f = engine.stage_forecast(plant, CFG, BASE)
    assert f["is_harvest_ready"] is True
    assert f["next_stage"] is None
    assert f["next_stage_eta"] is None
    assert f["harvest_eta"] is None
    assert f["stage_progress_pct"] == 100.0
    assert f["hours_to_harvest"] == 0.0


def test_service_forecast_uses_its_clock(session):
    _, _, plant = _plant(session)
    # 5-day window on purpose (not 4): an early random pest spawn — seeded by the
    # plant's id, so it varies per run — can infest the seedling and drag health
    # down, stretching the seed stage's effective duration (72h × (1+(100-health)
    # /200)) past the 4-day mark on some ids. That made a 4-day window flaky
    # ("still seed"). 5 days clears the stretched stage deterministically
    # (verified across 300 random ids). The plant is intentionally left uncared —
    # this asserts the *service uses its injected clock*, not ideal care.
    svc = SimulationService(session, config=CFG, clock=FrozenClock(BASE + timedelta(days=5)))
    svc.sync(plant)  # the /state route syncs before forecasting
    f = svc.forecast(plant)
    assert f["stage"] != GrowthStage.SEED.value  # advanced past the seed stage
    assert f["harvest_eta"] is not None
    assert f["age_hours"] == 120.0
