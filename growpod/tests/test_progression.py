"""Daily stipend cooldown + one-time achievement rewards."""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.progression_service import ProgressionService
from growpodempire.economy.config import load_economy_config
from growpodempire.simulation.clock import FrozenClock
from launch_economy import launch_config

BASE = datetime(2025, 1, 1, 12, 0, 0)
# Live balance.yaml boosts daily_stipend for testing; the launch config restores
# the canonical 50 GROW so the launch-faucet invariant stays guarded.
LAUNCH_CFG = launch_config()


@pytest.mark.skipif(
    load_economy_config().daily_stipend != 50.0,
    reason="dev stipend (balance.yaml daily_stipend != 50); restore to 50 to enforce the launch stipend",
)
def test_daily_stipend_cooldown(db):
    with session_scope() as s:
        p = GameService(s).create_player("daily")
        clock = FrozenClock(BASE)
        prog = ProgressionService(s, config=LAUNCH_CFG, clock=clock)
        first = prog.claim_daily(p.id)
        assert first["claimed"] == 50.0
        with pytest.raises(GameError):
            prog.claim_daily(p.id)            # still on cooldown
        clock.advance(hours=23)
        again = prog.claim_daily(p.id)         # cooldown elapsed
        assert again["claimed"] == 50.0


def test_achievement_unlock_and_claim_once(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("achiever")
        prog = ProgressionService(s, clock=FrozenClock(BASE))

        before = {a["key"]: a for a in prog.list_achievements(p.id)}
        assert before["first_harvest"]["unlocked"] is False

        # Grow + harvest once to unlock first_harvest.
        strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80)

        after = {a["key"]: a for a in prog.list_achievements(p.id)}
        assert after["first_harvest"]["unlocked"] is True

        reward = prog.claim_achievement(p.id, "first_harvest")
        assert reward["reward"] == 100
        with pytest.raises(GameError):
            prog.claim_achievement(p.id, "first_harvest")   # already claimed
