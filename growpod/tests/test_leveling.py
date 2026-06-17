"""Player XP/leveling: curve math and awards on actions."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.config import load_economy_config
from growpodempire.services.game_service import GameService
from growpodempire.services import leveling_service

CFG = load_economy_config()


def test_level_curve_thresholds():
    # curve_base=100 -> level 2 at 100xp, level 3 at 300xp, level 4 at 600xp.
    assert leveling_service.xp_for_level(1, CFG) == 0
    assert leveling_service.xp_for_level(2, CFG) == 100
    assert leveling_service.xp_for_level(3, CFG) == 300
    assert leveling_service.level_for_xp(0, CFG) == 1
    assert leveling_service.level_for_xp(150, CFG) == 2
    assert leveling_service.level_for_xp(300, CFG) == 3


def test_actions_award_xp(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("xp")
        assert p.xp == 0 and p.level == 1

        a = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        b = s.query(Strain).filter(Strain.slug == "white-widow").one()
        svc.breed(p.id, a.id, b.id, rng_seed=1)          # +40
        assert p.xp == 40

        stack = svc.buy_seed(p.id, a.id)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80)   # +25
        assert p.xp == 65
        assert p.level == 1
        prog = leveling_service.progress(p)
        assert prog["xp_for_next_level"] == 35   # 100 - 65
