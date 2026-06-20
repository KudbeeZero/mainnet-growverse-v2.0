"""Purchasable (simulated) growth boost: GROW sink + fast-forward + revive.

This is the in-game soft-currency purchase. The real-money checkout route is not
wired yet (see SimulationService.apply_growth_boost NOTE) — these tests pin the
SIMULATED behavior that is live now: it spends GROW, advances the lifecycle, and
revives a struggling plant, all on a cooldown.
"""

import os
import sys
from datetime import datetime
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance, get_wallet, InsufficientFundsError
from growpodempire.enums import GrowthStage, LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.simulation_service import SimulationService

BOOST = LedgerEntryType.GROWTH_BOOST


def _plant(session, name, stage=GrowthStage.VEGETATIVE.value, health=90.0):
    """A planted seed pinned to ~now (no incidental catch-up growth)."""
    svc = GameService(session)
    p = svc.create_player(name)
    strain = session.query(Strain).first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    plant.growth_stage = stage
    plant.health = health
    plant.height = 20.0
    now = datetime.utcnow()
    plant.last_tick_at = now
    plant.stage_entered_at = now
    pod.light_intensity = 700
    session.flush()
    return p.id, plant


def _cost(session) -> Decimal:
    sim = SimulationService(session)
    return Decimal(str(sim._sim.get("actions", {}).get("growth_boost", {}).get("cost", 60)))


def test_boost_spends_grow_and_posts_a_sink(session):
    pid, plant = _plant(session, "spender")
    before = balance(session, pid)
    SimulationService(session).apply_growth_boost(pid, plant.id)
    after = balance(session, pid)
    assert before - after == _cost(session)
    # The spend is recorded as exactly one GROWTH_BOOST ledger entry (a sink).
    session.flush()
    from growpodempire.db.models import LedgerEntry
    rows = session.query(LedgerEntry).filter(
        LedgerEntry.entry_type == BOOST.value
    ).all()
    assert len(rows) == 1
    assert rows[0].amount == -_cost(session)


def test_boost_fast_forwards_growth(session):
    pid, plant = _plant(session, "grower")
    # Sync to "now" first → captures height with no incidental catch-up left.
    SimulationService(session).get_state(pid, plant.id)
    h0 = plant.height
    SimulationService(session).apply_growth_boost(pid, plant.id)
    # The advance_hours jump grew the plant beyond where it sat at "now".
    assert plant.height > h0


def test_boost_revives_a_struggling_plant(session):
    pid, plant = _plant(session, "patient", health=10.0)
    SimulationService(session).apply_growth_boost(pid, plant.id)
    sim = SimulationService(session)
    floor = sim._sim["actions"]["growth_boost"]["recover_health_to"]
    assert plant.health >= floor
    # Resources were topped up too.
    assert plant.water_level >= sim._sim["actions"]["growth_boost"]["water_floor"] - 30
    assert plant.is_alive


def test_boost_is_on_cooldown(session):
    pid, plant = _plant(session, "impatient")
    SimulationService(session).apply_growth_boost(pid, plant.id)
    with pytest.raises(GameError):
        SimulationService(session).apply_growth_boost(pid, plant.id)


def test_boost_requires_funds(session):
    pid, plant = _plant(session, "broke")
    # Drain the wallet below the boost cost.
    get_wallet(session, pid).cached_balance = Decimal("5")
    session.flush()
    with pytest.raises(InsufficientFundsError):
        SimulationService(session).apply_growth_boost(pid, plant.id)
    # A failed payment leaves the plant untouched (no boost event logged).
    from growpodempire.db.models import PlantEvent
    boosted = session.query(PlantEvent).filter(
        PlantEvent.plant_id == plant.id,
        PlantEvent.event_type == "growth_boosted",
    ).all()
    assert boosted == []
