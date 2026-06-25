"""
Service-level tests for exam-attempt persistence and exam-gated completion.

Covers UniversityService.submit_exam (best-score accumulation, forgiving retries
that never un-pass) and complete_course's `requires_exam` gate: a course with a
required exam cannot be completed until that exam is passed. Grading is pure.
Mirrors test_university.py's session fixture + funded-player helper.
"""
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import CourseEnrollment, AssessmentAttempt
from growpodempire.enums import LedgerEntryType
from growpodempire.economy.ledger import post
from growpodempire.services import leveling_service
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.university_service import UniversityService
from growpodempire.services import assessment_service as A


def _player(session, name="examinee", level=2, grow=2000):
    svc = GameService(session)
    p = svc.create_player(name)
    need = 100 * level * (level - 1) // 2
    if need:
        leveling_service.award_xp(session, p.id, need)
    post(session, p.id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
    session.flush()
    return p


def _correct(exam_id):
    spec = A.exam("bio-101", exam_id)
    return {it["id"]: A._self_answer(it) for it in spec["items"]}


class TestSubmitExamPersistence:
    def test_first_attempt_records_row(self, session):
        p = _player(session)
        uni = UniversityService(session)
        out = uni.submit_exam(p.id, "bio-101", "mastery", _correct("mastery"))
        assert out["attempt"]["attempts"] == 1
        assert out["attempt"]["passed"] is True
        assert out["result"]["score"] == 1.0
        row = session.query(AssessmentAttempt).filter_by(player_id=p.id, exam_id="mastery").one()
        assert row.passed is True and row.best_score == 1.0

    def test_retry_keeps_best_score_and_never_unpasses(self, session):
        p = _player(session)
        uni = UniversityService(session)
        uni.submit_exam(p.id, "bio-101", "mastery", _correct("mastery"))   # pass
        out = uni.submit_exam(p.id, "bio-101", "mastery", {})              # worse (blank)
        assert out["result"]["passed"] is False    # this attempt failed
        assert out["attempt"]["passed"] is True      # row stays passed (forgiving)
        assert out["attempt"]["best_score"] == 1.0   # best score retained
        assert out["attempt"]["attempts"] == 2

    def test_unknown_exam_raises(self, session):
        p = _player(session)
        with pytest.raises(GameError):
            UniversityService(session).submit_exam(p.id, "bio-101", "nope", {})


class TestExamGatedCompletion:
    def _enroll_and_age(self, session, p):
        """Enroll in bio-101 and backdate study time so only the exam gate remains."""
        UniversityService(session).enroll(p.id, "bio-101")
        e = session.query(CourseEnrollment).filter_by(player_id=p.id, course_key="bio-101").one()
        e.started_at = datetime.utcnow() - timedelta(hours=100)
        session.flush()

    def test_cannot_complete_until_mastery_passed(self, session):
        p = _player(session)
        self._enroll_and_age(session, p)
        with pytest.raises(GameError, match="mastery exam"):
            UniversityService(session).complete_course(p.id, "bio-101")

    def test_completes_after_passing_mastery(self, session):
        p = _player(session)
        self._enroll_and_age(session, p)
        uni = UniversityService(session)
        uni.submit_exam(p.id, "bio-101", "mastery", _correct("mastery"))
        out = uni.complete_course(p.id, "bio-101")
        assert out["status"] == "completed"

    def test_failing_mastery_does_not_open_the_gate(self, session):
        p = _player(session)
        self._enroll_and_age(session, p)
        uni = UniversityService(session)
        uni.submit_exam(p.id, "bio-101", "mastery", {})  # fail
        with pytest.raises(GameError, match="mastery exam"):
            uni.complete_course(p.id, "bio-101")
