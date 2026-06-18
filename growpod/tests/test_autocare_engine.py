"""Auto-care engine branch coverage (Phase 3b).

Targets the UNCOVERED branches of the agentic auto-care loop that the existing
test_autocare.py / test_advisor.py do not reach: the SpendGuard gate paths
(action cap hit, unaffordable action skipped), the "nothing to treat" no-op
early returns, budget validation, the mock loop's mid-loop budget exhaustion and
its already-healthy short-circuit, plus the Claude provider's offline-reachable
surface (key guard, name, result formatter).

Everything runs against the OFFLINE MockAutoCareProvider — no API key, no
network. A plant is degraded via a session_scope() write against the live engine
(as test_advisor.py does) and care actions execute through the normal
ledger-posting path, so the loop stays server-authoritative.
"""

import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService
from growpodempire.services.autocare_service import (
    AutoCareService,
    _CareTools,
    _SpendGuard,
)
from growpodempire.services.game_service import GameError
from growpodempire.simulation.clock import FrozenClock
from growpodempire.ai.autocare import (
    MockAutoCareProvider,
    ClaudeAutoCareProvider,
    AutoCareError,
    ActionRecord,
    _fmt,
)

BASE = datetime(2025, 1, 1)


def _plant(s, clock, **levels):
    svc = GameService(s, clock=clock)
    p = svc.create_player("engine-carer")
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


def _tools(svc, player_id, plant, max_grow, max_actions):
    """A budget-guarded tool set bound to one plant for direct gate testing."""
    guard = _SpendGuard(max_grow, max_actions)
    return _CareTools(svc.sim, player_id, plant, guard), guard


# ---- service.run validation ------------------------------------------------
def test_run_rejects_non_positive_budget(db):
    """autocare_service.py:158 — budget clamps to <= 0 -> GameError."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, pest_level=6)
        with pytest.raises(GameError, match="budget must be positive"):
            _service(s, clock).run(p.id, plant.id, budget=0)


# ---- mock loop: mid-loop budget exhaustion message -------------------------
def test_mock_loop_reports_stop_when_budget_exhausted_midloop(db):
    """ai/autocare.py mock loop: a blocked action (disease unaffordable after the
    pest spend) makes the loop emit a 'stopped: ...' step and break — exercising
    the budget gate (autocare_service.py:111-style block surfaced via the loop)."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        # Budget 15 covers the 15-GROW pest treatment but not the 20-GROW disease.
        p, plant = _plant(s, clock, pest_level=6, disease_level=6)
        result = _service(s, clock).run(p.id, plant.id, budget=15)
        assert plant.pest_level == 0          # pests treated
        assert plant.disease_level > 0        # disease left: budget exhausted
        assert result["spent"] == 15.0
        # Loop recorded the successful pest treatment then announced the stop.
        assert "treat_pests" in result["message"]
        assert "stopped" in result["message"]
        assert "budget cap reached" in result["message"]


# ---- _gate: action cap reached (line 78) + water blocked return (line 89) ---
def test_gate_blocks_water_when_action_cap_reached(db):
    """autocare_service.py:78 (can_act() false) and :89 (water returns blocked).
    Water is free, so only the action cap — not the budget — can block it."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, water_level=10)
        tools, guard = _tools(_service(s, clock), p.id, plant, max_grow=200, max_actions=0)
        rec = tools.water()
        assert rec.ok is False
        assert rec.detail == "action cap reached"
        assert guard.records == []            # nothing executed / recorded
        assert plant.water_level == 10        # untouched


# ---- _gate: feed unaffordable -> blocked return (line 99) ------------------
def test_gate_blocks_feed_when_unaffordable(db):
    """autocare_service.py:99 — feed cost (5) exceeds the remaining budget."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, nutrient_level=10)
        before = balance(s, p.id)
        tools, guard = _tools(_service(s, clock), p.id, plant, max_grow=1, max_actions=8)
        rec = tools.feed()
        assert rec.ok is False
        assert "budget cap reached" in rec.detail
        assert guard.spent == 0.0
        assert balance(s, p.id) == before     # no ledger spend on a blocked action


# ---- treat_pests: present-but-unaffordable -> blocked (line 111) -----------
def test_gate_blocks_treat_pests_when_unaffordable(db):
    """autocare_service.py:111 — pests present (passes the <=0 guard) but the
    15-GROW treatment is unaffordable, so the gate blocks it."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock, pest_level=6)
        tools, guard = _tools(_service(s, clock), p.id, plant, max_grow=5, max_actions=8)
        rec = tools.treat_pests()
        assert rec.ok is False
        assert "budget cap reached" in rec.detail
        assert plant.pest_level == 6          # untreated
        assert guard.records == []


# ---- no-op early returns: nothing to treat (lines 107, 119) ---------------
def test_treat_pests_noop_when_no_pests(db):
    """autocare_service.py:107 — treat_pests on a pest-free plant: ok, free, no-op."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock)           # fresh plant: pest_level == 0
        before = balance(s, p.id)
        tools, guard = _tools(_service(s, clock), p.id, plant, max_grow=200, max_actions=8)
        rec = tools.treat_pests()
        assert rec.ok is True
        assert rec.cost == 0.0
        assert rec.detail == "no pests present"
        assert guard.records == []            # not counted against the action cap
        assert balance(s, p.id) == before


def test_treat_disease_noop_when_no_disease(db):
    """autocare_service.py:119 — treat_disease on a disease-free plant: no-op."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock)           # fresh plant: disease_level == 0
        before = balance(s, p.id)
        tools, guard = _tools(_service(s, clock), p.id, plant, max_grow=200, max_actions=8)
        rec = tools.treat_disease()
        assert rec.ok is True
        assert rec.cost == 0.0
        assert rec.detail == "no disease present"
        assert guard.records == []
        assert balance(s, p.id) == before


# ---- mock loop: already-healthy short-circuit (no actionable suggestions) --
def test_mock_loop_healthy_plant_returns_noop_message(db):
    """ai/autocare.py mock loop: a healthy plant produces no steps -> the
    'already in good shape' message and zero recorded actions."""
    clock = FrozenClock(BASE)
    with session_scope() as s:
        p, plant = _plant(s, clock)           # fresh: levels fine, no pests/disease
        before = balance(s, p.id)
        result = _service(s, clock).run(p.id, plant.id, budget=200)
        assert result["actions"] == []
        assert result["spent"] == 0.0
        assert "good shape" in result["message"]
        assert balance(s, p.id) == before


# ---- ClaudeAutoCareProvider offline surface (no network / no key call) -----
def test_claude_provider_requires_api_key():
    """ai/autocare.py:102-103 — constructing the real provider without a key
    raises immediately, before any network use."""
    with pytest.raises(AutoCareError, match="ANTHROPIC_API_KEY is required"):
        ClaudeAutoCareProvider(api_key="")


def test_claude_provider_name_includes_model():
    """ai/autocare.py:112 — name() reports the configured model."""
    prov = ClaudeAutoCareProvider(api_key="sk-ant-test", model="claude-test-x")
    assert prov.name() == "claude:claude-test-x"


def test_fmt_formats_ok_and_failed_records():
    """ai/autocare.py:172-174 — _fmt renders both the failure and success forms
    used by the Claude tool wrappers."""
    failed = _fmt(ActionRecord("feed", ok=False, detail="budget cap reached"))
    assert failed == "NOT DONE — budget cap reached"
    done = _fmt(ActionRecord("feed", ok=True, cost=5.0, detail="nutrient_level now 70"))
    assert done == "feed done (cost 5 GROW). nutrient_level now 70"
