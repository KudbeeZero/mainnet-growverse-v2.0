"""Agentic auto-care (Phase 3b): the mock provider's rule loop driving real,
budget-guarded care actions. No network/key — mirrors test_chain/test_advisor."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService
from growpodempire.services.autocare_service import AutoCareService
from growpodempire.simulation.clock import FrozenClock
from growpodempire.ai.autocare import MockAutoCareProvider

BASE = datetime(2025, 1, 1)


def _plant(s, clock, **levels):
    svc = GameService(s, clock=clock)
    p = svc.create_player("autocarer")
    strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Room", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for k, v in levels.items():
        setattr(plant, k, v)
    s.flush()
    return p, plant


def _service(s, clock):
    return AutoCareService(s, provider=MockAutoCareProvider(), clock=clock)


def test_auto_care_fixes_all_problems(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, pest_level=6, disease_level=6,
                           nutrient_level=10, water_level=10)
        before = balance(s, p.id)
        result = _service(s, clock).run(p.id, plant.id, budget=200)

        assert plant.pest_level == 0 and plant.disease_level == 0
        assert plant.nutrient_level >= 35 and plant.water_level >= 40
        assert len(result["actions"]) == 4
        assert all(a["ok"] for a in result["actions"])
        # Spent exactly the treatment + feed costs (15 + 20 + 5); water is free.
        assert result["spent"] == 40.0
        assert balance(s, p.id) == before - Decimal("40")


def test_auto_care_respects_action_cap(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, pest_level=6, disease_level=6)
        result = _service(s, clock).run(p.id, plant.id, budget=200, max_actions=1)
        assert len(result["actions"]) == 1
        # Highest-priority issue (pests) handled first; disease remains.
        assert plant.pest_level == 0 and plant.disease_level > 0


def test_auto_care_respects_budget_cap(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, pest_level=6, disease_level=6)
        # Budget only covers the 15-GROW pest treatment, not the 20-GROW disease one.
        result = _service(s, clock).run(p.id, plant.id, budget=15)
        assert result["spent"] <= 15.0
        assert plant.pest_level == 0      # pests treated
        assert plant.disease_level > 0    # disease left (budget exhausted)


def test_auto_care_healthy_plant_does_nothing(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock)  # fresh: water/nutrient 60, no pests/disease
        before = balance(s, p.id)
        result = _service(s, clock).run(p.id, plant.id, budget=200)
        assert result["actions"] == []
        assert balance(s, p.id) == before
