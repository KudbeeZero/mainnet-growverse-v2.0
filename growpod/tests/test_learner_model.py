"""Centralized learner model (Phase 6a): single authoritative writer + audit log.

The load-bearing guarantees under test:
  * SINGLE WRITER / FULLY AUDITED — every ``LearnerProfile`` mutation goes through
    ``LearnerModelService.apply`` and writes exactly one matching ``LearnerEvent``;
    a profile never changes without an audit row.
  * DETERMINISTIC mastery — fixed ``AssessmentAttempt`` rows always derive the same
    ``mastery_by_skill`` (values == best_scores).
  * NON-ECONOMIC — ``apply``/``recompute_*`` leave the GROW ledger and balance
    untouched (asserted before/after).
  * RISK — an enrolled-but-idle learner becomes ``at_risk``; an active streak ->
    ``none``.
  * ROUTE — the learner endpoint is authed + feature-gated (404 when off), and
    completing a course end-to-end populates mastery and writes audit rows.
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import (
    AssessmentAttempt,
    CourseEnrollment,
    LearnerEvent,
    LearnerProfile,
    LedgerEntry,
)
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services import leveling_service
from growpodempire.services.game_service import GameService
from growpodempire.services.learner_model_service import LearnerModelService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2026, 6, 1)
LATER = BASE + timedelta(hours=72)


# ----- helpers ---------------------------------------------------------------

def _player(session, name="learner", level=2, grow=2000):
    svc = GameService(session)
    p = svc.create_player(name)
    need = 100 * level * (level - 1) // 2
    if need:
        leveling_service.award_xp(session, p.id, need)
    if grow:
        post(session, p.id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
    session.flush()
    return p


def _attempt(session, pid, course_key, exam_id, best_score, passed=True):
    row = AssessmentAttempt(
        player_id=pid, course_key=course_key, exam_id=exam_id,
        attempts=1, best_score=best_score, passed=passed,
    )
    session.add(row)
    session.flush()
    return row


def _events(session, pid):
    return session.query(LearnerEvent).filter_by(player_id=pid).count()


# ===== single-writer invariant ===============================================

def test_every_mutation_writes_exactly_one_audit_row(session):
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))

    mutations = 0
    svc.apply(p.id, agent="admissions", kind="profile_update",
              detail={"experience_level": "intermediate"}, reason="intake")
    mutations += 1
    svc.apply(p.id, agent="roadmap", kind="risk_update",
              detail={"risk_level": "at_risk"}, reason="manual")
    mutations += 1
    _attempt(session, p.id, "cult-101", "midterm", 0.9)
    svc.recompute_mastery(p.id)
    mutations += 1
    svc.recompute_risk(p.id)
    mutations += 1

    # Every state change is audited: one event per mutation, one profile row.
    assert _events(session, p.id) == mutations
    assert session.query(LearnerProfile).filter_by(player_id=p.id).count() == 1


def test_profile_never_changes_without_an_audit_row(session):
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))
    svc.apply(p.id, agent="system", kind="profile_update",
              detail={"goals": "win the cup"}, reason="x")
    before = _events(session, p.id)
    prof = svc.profile(p.id)            # pure read
    assert prof["goals"] == "win the cup"
    assert _events(session, p.id) == before  # no read ever writes an event


def test_apply_is_the_only_mutator_no_orphan_changes(session):
    # recompute_* must go through apply (audited). Profile state and event count
    # advance together — never one without the other.
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))
    _attempt(session, p.id, "cult-101", "midterm", 0.75)
    e0 = _events(session, p.id)
    svc.recompute_mastery(p.id)
    assert _events(session, p.id) == e0 + 1
    svc.recompute_mastery(p.id)
    assert _events(session, p.id) == e0 + 2


# ===== deterministic mastery =================================================

def test_recompute_mastery_is_deterministic_and_matches_best_scores(session):
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))
    _attempt(session, p.id, "cult-101", "midterm", 0.8)
    _attempt(session, p.id, "nut-101", "midterm", 0.65)

    r1 = svc.recompute_mastery(p.id)
    m1 = dict(r1.mastery_by_skill)
    r2 = svc.recompute_mastery(p.id)
    m2 = dict(r2.mastery_by_skill)

    assert m1 == m2  # deterministic
    # 6b: keyed by the real skill_id each course teaches, value == best_score.
    assert m1 == {
        "cultivation-fundamentals": 0.8,  # cult-101
        "soil-nutrient-science": 0.65,    # nut-101
    }


def test_recompute_mastery_takes_max_best_score_across_a_courses_exams(session):
    # 6b: a course's contribution to its skill is its BEST best_score across all
    # of that course's exams (multiple exams collapse to one skill_id).
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))
    _attempt(session, p.id, "cult-101", "midterm", 0.7)
    _attempt(session, p.id, "cult-101", "mastery", 0.95)

    m = dict(svc.recompute_mastery(p.id).mastery_by_skill)
    # cult-101 teaches `cultivation-fundamentals`; the skill takes the max (0.95).
    assert m == {"cultivation-fundamentals": 0.95}


# ===== ledger-free ===========================================================

def test_apply_and_recompute_are_ledger_free(session):
    p = _player(session, grow=500)
    svc = LearnerModelService(session, clock=FrozenClock(BASE))
    _attempt(session, p.id, "cult-101", "midterm", 0.9)

    bal_before = balance(session, p.id)
    ledger_before = session.query(LedgerEntry).filter_by(player_id=p.id).count()

    svc.apply(p.id, agent="system", kind="risk_update",
              detail={"risk_level": "at_risk"}, reason="x")
    svc.recompute_mastery(p.id)
    svc.recompute_risk(p.id)

    assert balance(session, p.id) == bal_before
    assert session.query(LedgerEntry).filter_by(player_id=p.id).count() == ledger_before


def test_learner_model_module_imports_no_economy():
    import ast

    import growpodempire.services.learner_model_service as mod

    tree = ast.parse(open(mod.__file__, encoding="utf-8").read())
    imported: list = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    # The learner model is READ-ONLY w.r.t. the economy: it imports nothing from
    # the ledger/economy/wallet surfaces.
    for mod_name in imported:
        assert "economy" not in mod_name, f"must not import {mod_name!r}"
        assert "ledger" not in mod_name, f"must not import {mod_name!r}"
        assert "wallet" not in mod_name.lower(), f"must not import {mod_name!r}"


# ===== risk ==================================================================

def test_enrolled_but_idle_learner_is_at_risk(session):
    p = _player(session)
    # Enrolled, but no study activity recorded (no engagement row / zero streak).
    session.add(CourseEnrollment(
        player_id=p.id, course_key="cult-101", status="enrolled", started_at=BASE,
    ))
    session.flush()
    svc = LearnerModelService(session, clock=FrozenClock(LATER))
    assert svc.recompute_risk(p.id).risk_level == "at_risk"


def test_active_streak_clears_risk(session):
    from growpodempire.services.engagement_service import UniversityEngagementService

    p = _player(session)
    session.add(CourseEnrollment(
        player_id=p.id, course_key="cult-101", status="enrolled", started_at=BASE,
    ))
    session.flush()
    # A study event today gives a live streak + fresh last_study_date.
    today = LATER.date()
    UniversityEngagementService(session, clock=FrozenClock(LATER)).record_study_event(
        p.id, 100, today=today
    )
    svc = LearnerModelService(session, clock=FrozenClock(LATER))
    assert svc.recompute_risk(p.id).risk_level == "none"


def test_no_enrollment_is_not_at_risk(session):
    p = _player(session)
    svc = LearnerModelService(session, clock=FrozenClock(LATER))
    assert svc.recompute_risk(p.id).risk_level == "none"


# ===== read model ============================================================

def test_profile_defaults_when_no_rows(session):
    p = _player(session)
    prof = LearnerModelService(session).profile(p.id)
    assert prof["mastery_by_skill"] == {}
    assert prof["risk_level"] == "none"
    assert prof["experience_level"] == "beginner"
    # Engagement slice is merged in (zeros when no engagement row).
    assert prof["engagement"]["kxp"] == 0
    assert prof["engagement"]["streak_count"] == 0


# ===== HTTP route ============================================================

@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def _new_player(client, username="rstudent"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def test_learner_route_requires_auth(client):
    pid, _ = _new_player(client, "noauth_learner")
    assert client.get(
        f"/api/game/players/{pid}/university/learner"
    ).status_code in (401, 403)


def test_learner_route_404s_when_feature_disabled(client, monkeypatch):
    pid, key = _new_player(client, "feat_off_learner")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    r = client.get(
        f"/api/game/players/{pid}/university/learner", headers=_hdr(key)
    )
    assert r.status_code == 404


def test_learner_route_returns_default_profile(client):
    pid, key = _new_player(client, "fresh_learner")
    r = client.get(f"/api/game/players/{pid}/university/learner", headers=_hdr(key))
    assert r.status_code == 200
    body = r.get_json()
    assert body["mastery_by_skill"] == {}
    assert "engagement" in body


def test_completing_a_course_updates_learner_profile_and_audits(client):
    # End-to-end: complete a course over HTTP, then assert the learner profile got
    # mastery populated AND audit rows were written.
    from growpodempire.db.models import CourseEnrollment, Strain

    pid, key = _new_player(client, "e2e_learner")
    hdr = _hdr(key)
    # Fund + level up so enroll/complete are allowed.
    with session_scope() as s:
        post(s, pid, Decimal("2000"), LedgerEntryType.ADJUSTMENT)
        leveling_service.award_xp(s, pid, 100)  # reach level 2

    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=hdr)

    # Seed a graded attempt so completion's recompute_mastery has a best_score to
    # derive from (cult-101 has no exam bank, so we record the attempt directly).
    with session_scope() as s:
        _attempt(s, pid, "cult-101", "midterm", 0.85)

    # Backdate the enrollment so the time gate is satisfied, then satisfy the
    # practical (cult-101 needs harvest_count >= 1) via direct ORM on the test DB.
    with session_scope() as s:
        e = (
            s.query(CourseEnrollment)
            .filter_by(player_id=pid, course_key="cult-101")
            .one()
        )
        e.started_at = e.started_at - timedelta(hours=300)
        # Drive one harvest through GameService to satisfy the practical.
        g = GameService(s)
        strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        stack = g.buy_seed(pid, strain.id)
        pod = g.create_pod(pid, "Tent", charge=False)
        plant = g.plant_seed(pid, stack.id, pod.id)
        g.harvest_plant(pid, plant.id, weight_g=100, quality=80, sell=False)

    r = client.post(
        f"/api/game/players/{pid}/courses/cult-101/complete", headers=hdr
    )
    assert r.status_code == 201, r.get_json()

    # The learner endpoint now reflects mastery; audit rows exist.
    prof = client.get(
        f"/api/game/players/{pid}/university/learner", headers=hdr
    ).get_json()
    assert prof["mastery_by_skill"], "completing a course should populate mastery"

    with session_scope() as s:
        assert _events(s, pid) > 0  # course completion was audited
