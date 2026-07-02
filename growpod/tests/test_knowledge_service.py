"""
Global learning memory — Phase 1 capture (design/11-global-learning-memory.md).

Covers the load-bearing guarantees under test:
  * SINGLE WRITER — `KnowledgeService.append` is the only path that inserts a
    `knowledge_events` row; mirrors `LearnerModelService.apply`'s invariant
    (see `test_learner_model.py::test_apply_is_the_only_mutator_no_orphan_changes`).
  * HOOKS fire exactly once per triggering action, at exactly the 3 wired call
    sites: MasterGrowerService.ask (skips refused asks), LecturerService.teach
    (cache-miss only), UniversityService.submit_exam (every grade).
  * NON-ECONOMIC / LEDGER-FREE — append() never touches the GROW ledger,
    Wallet, or balance.yaml (mirrors
    `test_learner_model.py::test_apply_and_recompute_are_ledger_free`).
  * Provenance kept but nothing here exposes it — `player_id` stored, not read
    back through any public payload the read APIs return to OTHER players
    (append() itself is a pure writer, so this is asserted at the storage
    layer: the row keeps player_id for audit).
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import KnowledgeEvent, LedgerEntry
from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService
from growpodempire.services.knowledge_service import KnowledgeService
from growpodempire.services.master_grower_service import MasterGrowerService
from growpodempire.services.university_service import UniversityService
from growpodempire.services import assessment_service as A
from growpodempire.ai.master_grower_mock import MockMasterGrower
from growpodempire.ai.lecturer_mock import MockLecturerProvider
from growpodempire.services.lecturer_service import LecturerService
from growpodempire.services import leveling_service


def _events(session):
    return session.query(KnowledgeEvent).all()


def _correct(exam_id):
    spec = A.exam("bio-101", exam_id)
    return {it["id"]: A._self_answer(it) for it in spec["items"]}


def _player(session, name="knowledge_player", level=2, grow=2000):
    svc = GameService(session)
    p = svc.create_player(name)
    need = 100 * level * (level - 1) // 2
    if need:
        leveling_service.award_xp(session, p.id, need)
    if grow:
        post(session, p.id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
    session.flush()
    return p


# ===== single-writer invariant ==============================================

def test_append_is_the_only_writer_and_returns_the_row(session):
    p = _player(session)
    svc = KnowledgeService(session)
    row = svc.append("master_grower_qa", {"question": "q", "answer": "a"}, player_id=p.id)
    assert isinstance(row, KnowledgeEvent)
    assert row.event_type == "master_grower_qa"
    assert row.player_id == p.id
    assert _events(session) == [row]


def test_append_defaults_payload_and_player_id(session):
    svc = KnowledgeService(session)
    row = svc.append("care_outcome", {})
    assert row.payload == {}
    assert row.player_id is None


# ===== hook 1: MasterGrowerService.ask =======================================

def test_master_grower_substantive_answer_fires_exactly_one_event(db):
    with session_scope() as s:
        svc = MasterGrowerService(s, provider=MockMasterGrower())
        svc.ask("Tell me about Afghani")
        events = [e for e in _events(s) if e.event_type == "master_grower_qa"]
        assert len(events) == 1
        assert events[0].payload["question"] == "Tell me about Afghani"
        assert "answer" in events[0].payload
        assert "citations" in events[0].payload


def test_master_grower_refused_answer_creates_no_event(db):
    with session_scope() as s:
        svc = MasterGrowerService(s, provider=MockMasterGrower())
        report = svc.ask("What should I buy to win fastest?")
        assert report.refused
        events = [e for e in _events(s) if e.event_type == "master_grower_qa"]
        assert events == []


# ===== hook 2: LecturerService.teach (cache-miss only) =======================

def test_lecture_delivered_fires_once_per_course_not_per_delivery(db):
    with session_scope() as s:
        p1 = GameService(s).create_player("kx_l1")
        p2 = GameService(s).create_player("kx_l2")
        lecturer = LecturerService(s, provider=MockLecturerProvider())
        lecturer.teach(p1.id, "gen-101")   # cache miss -> 1 event
        lecturer.teach(p2.id, "gen-101")   # cache hit -> no event
        lecturer.teach(p1.id, "gen-101")   # cache hit -> no event

        events = [e for e in _events(s) if e.event_type == "lecture_delivered"]
        assert len(events) == 1
        assert events[0].payload == {"course_key": "gen-101", "title": events[0].payload["title"]}
        assert events[0].player_id == p1.id  # the FIRST (generating) requester


# ===== hook 3: UniversityService.submit_exam =================================

def test_submit_exam_fires_one_event_per_submission(session):
    p = _player(session)
    uni = UniversityService(session)
    uni.submit_exam(p.id, "bio-101", "mastery", _correct("mastery"))
    uni.submit_exam(p.id, "bio-101", "mastery", {})  # a second, worse attempt

    events = [e for e in _events(session) if e.event_type == "exam_result"]
    assert len(events) == 2
    assert events[0].payload == {
        "course_key": "bio-101", "exam_id": "mastery", "score": 1.0, "passed": True,
    }
    assert events[1].payload == {
        "course_key": "bio-101", "exam_id": "mastery", "score": 0.0, "passed": False,
    }
    assert all(e.player_id == p.id for e in events)


# ===== non-economic / ledger-free ============================================

def test_knowledge_events_and_hooks_are_ledger_free(session):
    p = _player(session, grow=500)
    bal_before = balance(session, p.id)
    ledger_before = session.query(LedgerEntry).filter_by(player_id=p.id).count()

    KnowledgeService(session).append("care_outcome", {"note": "healthy"}, player_id=p.id)
    uni = UniversityService(session)
    uni.submit_exam(p.id, "bio-101", "mastery", _correct("mastery"))

    assert balance(session, p.id) == bal_before
    assert session.query(LedgerEntry).filter_by(player_id=p.id).count() == ledger_before


def test_knowledge_service_module_imports_no_economy():
    import ast

    import growpodempire.services.knowledge_service as mod

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
