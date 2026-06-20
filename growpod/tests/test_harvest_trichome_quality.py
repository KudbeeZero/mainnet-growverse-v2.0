"""PR-C: harvest-timing coupling — trichome ripeness window nudges quality."""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService
from growpodempire.economy import pricing
from growpodempire.economy.config import load_economy_config
from growpodempire.enums import GrowthStage

CFG = load_economy_config()


def test_quality_window_delta_rewards_peak_penalises_overripe():
    assert pricing.quality_window_delta("peak", CFG) > 0
    assert pricing.quality_window_delta("ripe", CFG) > 0
    assert pricing.quality_window_delta("overripe", CFG) < 0
    assert pricing.quality_window_delta("developing", CFG) < 0
    # Unknown window (e.g. a pre-flower harvest) → no adjustment.
    assert pricing.quality_window_delta("not_flowering", CFG) == 0.0
    assert pricing.quality_window_delta("???", CFG) == 0.0


def _grow(session, stage, name, health=88.0):
    svc = GameService(session)
    p = svc.create_player(name)
    strain = session.query(Strain).first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    plant.growth_stage = stage
    plant.health = health
    # Pin the tick clock to ~now so harvest's catch-up doesn't advance the plant.
    now = datetime.utcnow()
    plant.last_tick_at = now
    plant.stage_entered_at = now  # progress ~0 within the stage
    pod.light_intensity = 700
    session.flush()
    return p.id, plant


def test_harvesting_too_early_yields_lower_quality_than_at_the_window(session):
    # Same health; one cut while still "developing" (flowering just begun), the
    # other at the ripe harvest window.
    pid_e, plant_e = _grow(session, GrowthStage.FLOWERING.value, "earlybird")
    h_early = GameService(session).harvest_plant(pid_e, plant_e.id, sell=False)

    pid_r, plant_r = _grow(session, GrowthStage.HARVEST.value, "ontime")
    h_ripe = GameService(session).harvest_plant(pid_r, plant_r.id, sell=False)

    assert h_early.quality < h_ripe.quality
    # And both stay within the valid quality range.
    assert 0.0 <= h_early.quality <= 100.0
    assert 0.0 <= h_ripe.quality <= 100.0
