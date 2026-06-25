"""Eval suite for the Admissions agent (Phase 6c).

Everything runs offline against the deterministic MockAdmissions (no key, no
network), mirroring test_master_grower.py / test_learner_model.py. The suite
asserts the load-bearing properties of the intake advisor:

  * deterministic — fixed answers -> an identical AdmissionsRecommendation across
                    calls; the department is real and every track course exists.
  * audited write — run_intake persists ONLY through LearnerModelService.apply:
                    exactly one new LearnerEvent (agent="admissions",
                    kind="profile_update") whose detail carries the recommendation,
                    and the profile's experience_level == rec.level.
  * ledger-free  — no LedgerEntry is created by run_intake (non-economic).
  * factory      — returns the mock with no key; singleton + reset behave.
  * route        — feature-gated (404 off), authed, 200 + recommendation/profile on.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from types import SimpleNamespace

from growpodempire.ai import factory as ai_factory
from growpodempire.ai.admissions_mock import INTAKE_QUIZ, MockAdmissions
from growpodempire.ai.provider import AdmissionsRecommendation
from growpodempire.db.models import LearnerEvent, LearnerProfile, LedgerEntry
from growpodempire.db.session import session_scope
from growpodempire.services.admissions_service import AdmissionsService
from growpodempire.services.game_service import GameService
from growpodempire.services.university_service import load_curriculum


def _settings(**over):
    base = dict(use_mock_ai=False, anthropic_api_key=None, advisor_model="claude-opus-4-8")
    base.update(over)
    return SimpleNamespace(**base)


# Fixed answers that lean clearly toward cultivation, with intermediate experience.
_CULTIVATION_ANSWERS = {
    "goal": "big_harvests",      # cultivation +2
    "trouble": "environment",    # cultivation +1, nutrients +1
    "enjoy": "scouting",         # ipm +2
    "outcome": "yield",          # cultivation +2
    "experience": "some",        # -> intermediate
}


def _player(session, name="admit"):
    return GameService(session).create_player(name)


# ===== factory ============================================================
def test_factory_returns_mock_without_key():
    provider = ai_factory.get_admissions_provider(_settings())
    assert isinstance(provider, MockAdmissions)
    assert provider.name() == "mock"


def test_factory_returns_mock_when_use_mock_ai_no_key_needed():
    provider = ai_factory.get_admissions_provider(
        _settings(use_mock_ai=True, anthropic_api_key="sk-ant-xxx")
    )
    assert isinstance(provider, MockAdmissions)


def test_factory_singleton_and_reset():
    ai_factory.reset_shared_admissions()
    try:
        a = ai_factory.shared_admissions(_settings(use_mock_ai=True))
        assert isinstance(a, MockAdmissions)
        assert ai_factory.shared_admissions(_settings(use_mock_ai=True)) is a
        ai_factory.reset_shared_admissions()
        b = ai_factory.shared_admissions(_settings(use_mock_ai=True))
        assert b is not a
    finally:
        ai_factory.reset_shared_admissions()


# ===== deterministic recommendation =======================================
def test_recommendation_is_deterministic_and_uses_real_keys(db):
    provider = MockAdmissions()
    r1 = provider.recommend(_CULTIVATION_ANSWERS)
    r2 = provider.recommend(_CULTIVATION_ANSWERS)
    assert isinstance(r1, AdmissionsRecommendation)
    # Byte-stable: same answers -> identical recommendation.
    assert r1.model_dump() == r2.model_dump()

    curriculum = load_curriculum()
    departments = curriculum.get("departments", {})
    courses = curriculum.get("courses", {})
    # The recommended department is a REAL curriculum department.
    assert r1.department in departments
    assert r1.school == r1.department
    # These answers lean cultivation (5 cultivation pts vs others).
    assert r1.department == "cultivation"
    assert r1.level == "intermediate"
    # Every track entry is a real course key IN that department.
    assert r1.track  # non-empty
    for course_key in r1.track:
        assert course_key in courses, f"track course {course_key} not in curriculum"
        assert courses[course_key]["department"] == r1.department
    # Ordered by level_req then key (deterministic sequence).
    reqs = [int(courses[c].get("level_req", 0)) for c in r1.track]
    assert reqs == sorted(reqs)


def test_unknown_or_missing_answers_do_not_crash(db):
    provider = MockAdmissions()
    rec = provider.recommend({"goal": "not-a-choice", "nope": "x"})
    # Defaults sensibly: cultivation starter track, beginner level.
    assert rec.department == "cultivation"
    assert rec.level == "beginner"
    assert rec.track
    # Empty answers also yield a valid recommendation.
    assert provider.recommend({}).department == "cultivation"


def test_quiz_is_exposed_and_well_formed():
    quiz = MockAdmissions().quiz()
    assert quiz is INTAKE_QUIZ
    ids = {q["id"] for q in quiz}
    assert "experience" in ids  # the level-deriving question is present
    for q in quiz:
        assert q["choices"]


# ===== audited write through apply() ======================================
def test_run_intake_audits_through_apply_and_sets_profile(session):
    p = _player(session)
    before = session.query(LearnerEvent).filter_by(player_id=p.id).count()

    out = AdmissionsService(session).run_intake(p.id, _CULTIVATION_ANSWERS)
    rec = out["recommendation"]

    # Exactly one new LearnerEvent, written by apply() (single writer).
    events = session.query(LearnerEvent).filter_by(player_id=p.id).all()
    assert len(events) == before + 1
    ev = events[-1]
    assert ev.agent == "admissions"
    assert ev.kind == "profile_update"
    # The full recommendation is captured on the audit row's detail.
    assert ev.detail["department"] == rec["department"]
    assert ev.detail["track"] == rec["track"]
    assert ev.detail["level"] == rec["level"]

    # The profile's experience_level == rec.level (set via profile_update).
    prof_row = session.query(LearnerProfile).filter_by(player_id=p.id).one()
    assert prof_row.experience_level == rec["level"]
    assert prof_row.goals  # a concise track/department summary was stored
    # The returned profile read model reflects the same.
    assert out["profile"]["experience_level"] == rec["level"]


# ===== ledger-free ========================================================
def test_run_intake_is_ledger_free(session):
    p = _player(session)
    session.flush()  # settle any signup-grant postings before the measurement
    ledger_before = session.query(LedgerEntry).filter_by(player_id=p.id).count()
    AdmissionsService(session).run_intake(p.id, _CULTIVATION_ANSWERS)
    # No economic side effects: the ledger is untouched.
    assert session.query(LedgerEntry).filter_by(player_id=p.id).count() == ledger_before


def test_admissions_service_imports_no_economy():
    import ast

    import growpodempire.services.admissions_service as mod

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


def _new_player(client, username="astudent"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def test_admissions_route_requires_auth(client):
    pid, _ = _new_player(client, "noauth_admit")
    r = client.post(
        f"/api/game/players/{pid}/university/admissions",
        json={"answers": _CULTIVATION_ANSWERS},
    )
    assert r.status_code in (401, 403)


def test_admissions_route_404s_when_feature_disabled(client, monkeypatch):
    pid, key = _new_player(client, "feat_off_admit")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    r = client.post(
        f"/api/game/players/{pid}/university/admissions",
        json={"answers": _CULTIVATION_ANSWERS},
        headers=_hdr(key),
    )
    assert r.status_code == 404


def test_admissions_route_returns_recommendation_and_profile(client):
    pid, key = _new_player(client, "admit_ok")
    r = client.post(
        f"/api/game/players/{pid}/university/admissions",
        json={"answers": _CULTIVATION_ANSWERS},
        headers=_hdr(key),
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["recommendation"]["department"] == "cultivation"
    assert body["recommendation"]["level"] == "intermediate"
    assert body["recommendation"]["track"]
    assert body["profile"]["experience_level"] == "intermediate"
    # The write was audited under the centralized learner model.
    with session_scope() as s:
        ev = (
            s.query(LearnerEvent)
            .filter_by(player_id=pid, agent="admissions", kind="profile_update")
            .one()
        )
        assert ev.detail["track"] == body["recommendation"]["track"]


def test_admissions_quiz_route_is_public_and_lists_questions(client):
    r = client.get("/api/game/university/admissions/quiz")
    assert r.status_code == 200
    quiz = r.get_json()["quiz"]
    assert any(q["id"] == "experience" for q in quiz)


def test_admissions_quiz_route_404s_when_feature_disabled(client, monkeypatch):
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    assert client.get("/api/game/university/admissions/quiz").status_code == 404
