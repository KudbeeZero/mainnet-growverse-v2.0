"""ACCELERATE TIME — the command center's +1h / +6h / +1d time-jump.

`advance_plant` fast-forwards a plant's grow clock by N hours via the deterministic
engine recompute (the same mechanism the growth boost uses, minus the cost/revive).
It must move growth forward, post NO ledger entry (it's a free time control), and
clamp absurd values instead of raising. Determinism via a FrozenClock.
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, LedgerEntry
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService
from growpodempire.services.simulation_service import SimulationService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1, 0, 0, 0)


def _plant(session, slug="white-widow"):
    svc = GameService(session)
    p = svc.create_player("timefarmer")
    strain = session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, BASE)
    pod.temperature = 24
    pod.humidity = 50
    pod.co2_level = 1000
    pod.light_intensity = 500
    pod.ph_level = 6.5
    session.flush()
    return p.id, pod, plant


def test_advance_fast_forwards_growth(db):
    with session_scope() as s:
        pid, _, plant = _plant(s)
        assert plant.growth_stage == "seed"
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.advance_plant(pid, plant.id, hours=6)
        # The grow clock jumped forward → no longer a fresh seed.
        assert plant.growth_stage != "seed"


def test_advance_is_free(db):
    with session_scope() as s:
        pid, _, plant = _plant(s)
        before = balance(s, pid)
        n0 = s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count()
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.advance_plant(pid, plant.id, hours=1)
        assert balance(s, pid) == before
        assert s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count() == n0


def test_advance_clamps_absurd_jump_without_raising(db):
    with session_scope() as s:
        pid, _, plant = _plant(s)
        sim = SimulationService(s, clock=FrozenClock(BASE))
        # Far beyond the catch-up cap → clamped to one window, not an error.
        result = sim.advance_plant(pid, plant.id, hours=10_000_000)
        assert result.id == plant.id
