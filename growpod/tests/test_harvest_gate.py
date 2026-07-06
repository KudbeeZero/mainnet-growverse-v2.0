"""Harvest gate — a player cannot harvest a plant that hasn't reached flowering,
nor one that has died. Guards the disruptor-sweep finding #1: without this, a
brand-new seed (health defaults to 100) could be harvested for full value at t=0
via the API, bypassing the grow → care loop.

The gate applies only to the player-facing computed path (no weight_g/quality
overrides), exactly the path the API route uses. Internal fixtures that fabricate
a harvest with explicit weight_g AND quality are intentionally unaffected.
"""

import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService, GameError
from growpodempire.enums import GrowthStage


def _plant(session, name, stage, *, health=90.0, alive=True):
    svc = GameService(session)
    p = svc.create_player(name)
    strain = session.query(Strain).first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    plant.growth_stage = stage
    plant.health = health
    plant.is_alive = alive
    # Pin the tick clock to ~now so harvest's catch-up doesn't advance the stage.
    now = datetime.utcnow()
    plant.last_tick_at = now
    plant.stage_entered_at = now
    pod.light_intensity = 700
    session.flush()
    return p.id, plant


def test_cannot_harvest_a_seed_stage_plant(session):
    """The exploit: plant a seed, immediately harvest via the player path."""
    pid, plant = _plant(session, "seedharvester", GrowthStage.SEED.value)
    with pytest.raises(GameError):
        GameService(session).harvest_plant(pid, plant.id, sell=False)


def test_cannot_harvest_a_vegetative_plant(session):
    pid, plant = _plant(session, "vegharvester", GrowthStage.VEGETATIVE.value)
    with pytest.raises(GameError):
        GameService(session).harvest_plant(pid, plant.id, sell=False)


def test_cannot_harvest_a_dead_plant(session):
    """A dead plant is cleared via cleanup_plant, never harvested for value."""
    pid, plant = _plant(session, "deadharvester", GrowthStage.FLOWERING.value, alive=False)
    with pytest.raises(GameError):
        GameService(session).harvest_plant(pid, plant.id, sell=False)


def test_can_harvest_a_flowering_plant(session):
    """A legitimately grown, flowering, living plant harvests fine (player path)."""
    pid, plant = _plant(session, "realgrower", GrowthStage.FLOWERING.value)
    h = GameService(session).harvest_plant(pid, plant.id, sell=False)
    assert h.weight_g > 0
    assert h.quality > 0


def test_explicit_override_path_is_unaffected(session):
    """Internal fixtures fabricate a harvest with explicit weight_g AND quality on
    an arbitrary-stage plant; the gate must not touch that path."""
    pid, plant = _plant(session, "fixture", GrowthStage.SEED.value)
    h = GameService(session).harvest_plant(pid, plant.id, weight_g=100, quality=90, sell=False)
    assert h.weight_g == 100
    assert h.quality == 90
