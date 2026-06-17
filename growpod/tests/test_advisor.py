"""AI Master Grower advisor: mock provider, factory selection, service flow.

All tests use the offline MockAdvisorProvider — no network or API key. This
mirrors how test_chain.py uses MockChainProvider.
"""

import os
import sys
from datetime import datetime
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Plant
from growpodempire.services.game_service import GameService
from growpodempire.services.advisor_service import AdvisorService
from growpodempire.simulation.clock import FrozenClock
from growpodempire.ai.mock import MockAdvisorProvider
from growpodempire.ai.provider import AdvisorReport
from growpodempire.ai.factory import get_advisor_provider

BASE = datetime(2025, 1, 1)


# ----- factory ------------------------------------------------------------
def test_factory_returns_mock_without_key():
    settings = SimpleNamespace(use_mock_ai=False, anthropic_api_key=None,
                               advisor_model="claude-opus-4-8")
    provider = get_advisor_provider(settings)
    assert isinstance(provider, MockAdvisorProvider)
    assert provider.name() == "mock"


def test_factory_respects_use_mock_ai_even_with_key():
    settings = SimpleNamespace(use_mock_ai=True, anthropic_api_key="sk-ant-xxx",
                               advisor_model="claude-opus-4-8")
    assert isinstance(get_advisor_provider(settings), MockAdvisorProvider)


# ----- mock provider logic ------------------------------------------------
def _ctx(**plant):
    base = {"growth_stage": "vegetative", "health": 100, "water_level": 60,
            "nutrient_level": 60, "pest_level": 0, "disease_level": 0}
    base.update(plant)
    return {"plant": base, "genome": {}, "environment": {}, "recent_events": []}


def test_mock_flags_critical_low_water():
    report = MockAdvisorProvider().diagnose(_ctx(water_level=10, health=40))
    assert isinstance(report, AdvisorReport)
    waters = [s for s in report.suggestions if s.action == "water"]
    assert waters and waters[0].urgency == "now"


def test_mock_flags_pests_and_disease():
    report = MockAdvisorProvider().diagnose(_ctx(pest_level=6, disease_level=6, health=45))
    actions = {s.action for s in report.suggestions}
    assert {"treat_pests", "treat_disease"} <= actions
    assert report.severity in ("serious", "critical")


def test_mock_healthy_plant_says_wait():
    report = MockAdvisorProvider().diagnose(_ctx())
    assert report.severity == "healthy"
    assert any(s.action == "wait" for s in report.suggestions)


# ----- service flow -------------------------------------------------------
def _planted(s, clock):
    svc = GameService(s, clock=clock)
    p = svc.create_player("grower")
    strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Room", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    return p, plant


def test_advisor_service_reads_live_state(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _planted(s, clock)
        # Force a problem state; FrozenClock => catch-up advances 0 hours.
        plant.water_level = 8.0
        plant.nutrient_level = 15.0
        s.flush()

        advisor = AdvisorService(s, provider=MockAdvisorProvider(), clock=clock)
        report = advisor.advise(p.id, plant.id)

        actions = {sug.action for sug in report.suggestions}
        assert "water" in actions and "feed" in actions
        assert report.severity in ("minor", "serious", "critical")


def test_advisor_context_includes_genome_and_environment(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _planted(s, clock)
        advisor = AdvisorService(s, provider=MockAdvisorProvider(), clock=clock)
        ctx = advisor.build_context(p.id, plant.id)
        assert "thc" in ctx["genome"]            # genome summary populated
        assert "temperature" in ctx["environment"]
        assert ctx["plant"]["growth_stage"]


def test_advisor_is_research_aware(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _planted(s, clock)
        advisor = AdvisorService(s, provider=MockAdvisorProvider(), clock=clock)
        ctx = advisor.build_context(p.id, plant.id)
        # A fresh level-1 player has unlocked nothing but has cheap nodes available.
        assert ctx["research"]["unlocked"] == []
        assert len(ctx["research"]["recommended_next"]) >= 1
        # The mock advisor coaches the next upgrade in its diagnosis.
        report = advisor.advise(p.id, plant.id)
        assert "researching" in report.diagnosis.lower()
