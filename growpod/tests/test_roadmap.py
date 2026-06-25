"""Eval suite for the Roadmap agent (Phase 6d).

Everything runs offline against the deterministic MockRoadmap (no key, no network),
mirroring test_admissions.py / test_learner_model.py. The suite asserts the
load-bearing properties of the path-builder:

  * PREREQUISITES NEVER VIOLATED — walking the ordered steps, every skill's real
    prerequisites (from skills.yaml via the loader) appear earlier OR are already
    mastered. This is the core invariant.
  * MASTERED SKILLS SKIPPED — skills at/above the threshold never appear in steps
    and DO appear in skipped_mastered.
  * DETERMINISTIC — same mastery + horizon -> an identical RoadmapPlan.
  * COVERS THE GRAPH — every non-mastered skill appears exactly once.
  * READ-ONLY / LEDGER-FREE — the service writes nothing and imports no economy.
  * ROUTE — feature-gated (404 off), authed, 200 + plan on; ?horizon=14 honored.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from types import SimpleNamespace

from growpodempire.ai import factory as ai_factory
from growpodempire.ai.roadmap_mock import MASTERY_THRESHOLD, MockRoadmap
from growpodempire.ai.provider import RoadmapPlan
from growpodempire.db.models import LearnerEvent, LearnerProfile, LedgerEntry
from growpodempire.services.game_service import GameService
from growpodempire.services.roadmap_service import RoadmapService
from growpodempire.services.skills import load_skills


def _settings(**over):
    base = dict(use_mock_ai=False, anthropic_api_key=None, advisor_model="claude-opus-4-8")
    base.update(over)
    return SimpleNamespace(**base)


def _skills():
    return load_skills().get("skills", {}) or {}


def _prereqs(skill_id):
    return list((_skills().get(skill_id) or {}).get("prerequisites", []) or [])


def _player(session, name="roadmapper"):
    return GameService(session).create_player(name)


# ===== factory ============================================================
def test_factory_returns_mock_without_key():
    provider = ai_factory.get_roadmap_provider(_settings())
    assert isinstance(provider, MockRoadmap)
    assert provider.name() == "mock"


def test_factory_returns_mock_when_use_mock_ai_no_key_needed():
    provider = ai_factory.get_roadmap_provider(
        _settings(use_mock_ai=True, anthropic_api_key="sk-ant-xxx")
    )
    assert isinstance(provider, MockRoadmap)


def test_factory_singleton_and_reset():
    ai_factory.reset_shared_roadmap()
    try:
        a = ai_factory.shared_roadmap(_settings(use_mock_ai=True))
        assert isinstance(a, MockRoadmap)
        assert ai_factory.shared_roadmap(_settings(use_mock_ai=True)) is a
        ai_factory.reset_shared_roadmap()
        b = ai_factory.shared_roadmap(_settings(use_mock_ai=True))
        assert b is not a
    finally:
        ai_factory.reset_shared_roadmap()


# ===== prerequisites NEVER violated (core invariant) ======================

def _assert_prereqs_respected(plan: RoadmapPlan):
    """Walk the steps in order; for each, every real prerequisite must appear
    earlier in the path OR be in skipped_mastered (already satisfied)."""
    satisfied = set(plan.skipped_mastered)
    seen = set()
    for step in plan.steps:
        for pre in _prereqs(step.skill_id):
            assert pre in satisfied or pre in seen, (
                f"{step.skill_id} scheduled before prereq {pre}"
            )
        seen.add(step.skill_id)


@pytest.mark.parametrize("horizon", [7, 14])
def test_prereqs_respected_from_empty_mastery(horizon):
    plan = MockRoadmap().recommend(mastery_by_skill={}, horizon_days=horizon)
    # Empty mastery -> the full path from the root (plant-biology) onward.
    assert plan.skipped_mastered == []
    assert plan.steps[0].skill_id == "plant-biology"  # the only no-prereq root
    _assert_prereqs_respected(plan)


@pytest.mark.parametrize("horizon", [7, 14])
def test_prereqs_respected_from_partial_mastery(horizon):
    # Master a couple of mid-chain skills (and their roots), leaving advanced ones.
    mastery = {
        "plant-biology": 0.9,
        "cultivation-fundamentals": 0.85,
        "inheritance-genetics": 0.75,
    }
    plan = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=horizon)
    _assert_prereqs_respected(plan)
    # The mastered ones are gone from steps and present in skipped.
    step_ids = {s.skill_id for s in plan.steps}
    assert step_ids.isdisjoint(mastery.keys())
    assert set(plan.skipped_mastered) == set(mastery.keys())


def test_days_are_non_decreasing_in_path_order():
    plan = MockRoadmap().recommend(mastery_by_skill={}, horizon_days=7)
    days = [s.day for s in plan.steps]
    assert days == sorted(days)  # a prereq is never scheduled on a later day
    assert all(1 <= d <= 7 for d in days)


# ===== mastered skills are skipped ========================================

def test_mastered_skills_are_skipped():
    all_ids = set(_skills().keys())
    # Master exactly the foundational root at the threshold boundary.
    mastery = {"plant-biology": MASTERY_THRESHOLD}
    plan = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=7)
    step_ids = {s.skill_id for s in plan.steps}
    assert "plant-biology" not in step_ids
    assert "plant-biology" in plan.skipped_mastered
    # Below threshold is NOT mastered -> stays in the path.
    below = MockRoadmap().recommend(
        mastery_by_skill={"plant-biology": MASTERY_THRESHOLD - 0.01}, horizon_days=7
    )
    assert "plant-biology" in {s.skill_id for s in below.steps}
    assert below.skipped_mastered == []
    # Sanity: skipped + steps partition the full graph.
    assert step_ids | set(plan.skipped_mastered) == all_ids


def test_all_mastered_yields_empty_path():
    mastery = {sid: 1.0 for sid in _skills()}
    plan = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=7)
    assert plan.steps == []
    assert set(plan.skipped_mastered) == set(_skills().keys())


# ===== deterministic ======================================================

@pytest.mark.parametrize("horizon", [7, 14])
def test_deterministic(horizon):
    mastery = {"plant-biology": 0.9, "soil-nutrient-science": 0.8}
    p1 = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=horizon)
    p2 = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=horizon)
    assert isinstance(p1, RoadmapPlan)
    assert p1.model_dump() == p2.model_dump()  # byte-stable


# ===== covers the graph ===================================================

def test_covers_every_unmastered_skill_exactly_once():
    mastery = {"plant-biology": 0.9}
    plan = MockRoadmap().recommend(mastery_by_skill=mastery, horizon_days=7)
    step_ids = [s.skill_id for s in plan.steps]
    expected = set(_skills().keys()) - {"plant-biology"}
    assert len(step_ids) == len(set(step_ids))  # no dupes
    assert set(step_ids) == expected  # no omissions
    # Steps carry the real name/domain/prereqs from the graph.
    for s in plan.steps:
        rec = _skills()[s.skill_id]
        assert s.name == rec["name"]
        assert s.domain == rec["domain"]
        assert s.prerequisites == list(rec.get("prerequisites", []) or [])


# ===== service: read-only + ledger-free ===================================

def test_service_is_read_only(session):
    p = _player(session)
    ev_before = session.query(LearnerEvent).filter_by(player_id=p.id).count()
    prof_before = session.query(LearnerProfile).filter_by(player_id=p.id).count()

    out = RoadmapService(session).roadmap(p.id, horizon_days=7)

    # The roadmap mutates NOTHING: no new audit rows, no profile created.
    assert session.query(LearnerEvent).filter_by(player_id=p.id).count() == ev_before
    assert session.query(LearnerProfile).filter_by(player_id=p.id).count() == prof_before
    # Fresh player -> empty mastery -> the full path from the root.
    assert out["steps"][0]["skill_id"] == "plant-biology"
    assert out["skipped_mastered"] == []
    assert out["mastery_by_skill"] == {}


def test_service_is_ledger_free(session):
    p = _player(session)
    session.flush()
    ledger_before = session.query(LedgerEntry).filter_by(player_id=p.id).count()
    RoadmapService(session).roadmap(p.id, horizon_days=7)
    assert session.query(LedgerEntry).filter_by(player_id=p.id).count() == ledger_before


def test_roadmap_service_imports_no_economy():
    import ast

    import growpodempire.services.roadmap_service as mod

    tree = ast.parse(open(mod.__file__, encoding="utf-8").read())
    imported: list = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    for mod_name in imported:
        assert "economy" not in mod_name, f"must not import {mod_name!r}"
        assert "ledger" not in mod_name, f"must not import {mod_name!r}"
        assert "wallet" not in mod_name.lower(), f"must not import {mod_name!r}"


# ===== HTTP route =========================================================
@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def _new_player(client, username="rmstudent"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def test_roadmap_route_requires_auth(client):
    pid, _ = _new_player(client, "noauth_roadmap")
    assert client.get(
        f"/api/game/players/{pid}/university/roadmap"
    ).status_code in (401, 403)


def test_roadmap_route_404s_when_feature_disabled(client, monkeypatch):
    pid, key = _new_player(client, "feat_off_roadmap")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    r = client.get(
        f"/api/game/players/{pid}/university/roadmap", headers=_hdr(key)
    )
    assert r.status_code == 404


def test_roadmap_route_returns_plan(client):
    pid, key = _new_player(client, "roadmap_ok")
    r = client.get(f"/api/game/players/{pid}/university/roadmap", headers=_hdr(key))
    assert r.status_code == 200
    body = r.get_json()
    assert body["horizon_days"] == 7
    assert body["steps"][0]["skill_id"] == "plant-biology"
    assert body["skipped_mastered"] == []
    # The plan still respects prerequisites over HTTP.
    plan = RoadmapPlan(**{k: body[k] for k in ("horizon_days", "steps", "skipped_mastered", "rationale")})
    _assert_prereqs_respected(plan)


def test_roadmap_route_honors_horizon_14(client):
    pid, key = _new_player(client, "roadmap_14")
    r = client.get(
        f"/api/game/players/{pid}/university/roadmap?horizon=14", headers=_hdr(key)
    )
    assert r.status_code == 200
    assert r.get_json()["horizon_days"] == 14
