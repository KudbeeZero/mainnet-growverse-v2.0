"""GrowPod University Professor: CI-safe mock lecturer (no API key).

Also covers the PRODUCE-ONCE TEXT fix (2026-07-02, HERMES hard rule): a
course's lecture must be generated via the provider AT MOST ONCE, ever — every
subsequent `teach()` call (any player, any level/plant_id) is a pure cache
read of the saved `LectureContent` row. Mirrors the already-shipped
produce-once AUDIO invariant.
"""

import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import KnowledgeEvent, LectureContent
from growpodempire.db.session import session_scope
from growpodempire.services.game_service import GameService
from growpodempire.services.lecturer_service import LecturerService
from growpodempire.ai.lecturer_mock import MockLecturerProvider
from growpodempire.ai.provider import LectureReport
from growpodempire.ai.factory import get_lecturer_provider


def test_factory_returns_mock_without_key():
    settings = SimpleNamespace(
        use_mock_ai=False, anthropic_api_key=None, advisor_model="claude-opus-4-8"
    )
    provider = get_lecturer_provider(settings)
    assert isinstance(provider, MockLecturerProvider)
    assert provider.name() == "mock"


def test_mock_lecture_is_deterministic():
    p = MockLecturerProvider()
    ctx = {"course": "Plant Genetics", "topic": "Inheritance basics", "objectives": ["Predict traits"], "level": "beginner"}
    a = p.lecture(ctx)
    b = p.lecture(ctx)
    assert isinstance(a, LectureReport)
    assert a.title == b.title and a.content == b.content
    assert a.key_takeaways and a.quiz_question


def test_lecturer_service_returns_a_lecture_for_a_real_course(db):
    with session_scope() as s:
        p = GameService(s).create_player("learner")
        lecturer = LecturerService(s, provider=MockLecturerProvider())
        report = lecturer.teach(p.id, "gen-101", level="beginner")
        assert isinstance(report, LectureReport)
        assert "Genetics" in report.title or "Genetics" in report.content
        assert len(report.key_takeaways) >= 1


# ===== produce-once TEXT (cache-first, single provider call per course) =====

class _CountingLecturerProvider(MockLecturerProvider):
    """The real mock, but counts how many times `lecture()` is actually called
    — lets tests assert the provider was NOT hit on a cache read."""

    def __init__(self):
        self.calls = 0

    def lecture(self, context: dict) -> LectureReport:
        self.calls += 1
        return super().lecture(context)


def test_cache_miss_generates_once_and_persists(db):
    with session_scope() as s:
        p = GameService(s).create_player("first_learner")
        provider = _CountingLecturerProvider()
        lecturer = LecturerService(s, provider=provider)
        report = lecturer.teach(p.id, "gen-101")
        assert provider.calls == 1
        row = (
            s.query(LectureContent)
            .filter(LectureContent.course_key == "gen-101")
            .one()
        )
        assert row.title == report.title
        assert row.content == report.content
        assert row.provider == "mock"


def test_cache_hit_avoids_calling_the_provider(db):
    with session_scope() as s:
        p1 = GameService(s).create_player("learner_one")
        p2 = GameService(s).create_player("learner_two")
        provider = _CountingLecturerProvider()
        lecturer = LecturerService(s, provider=provider)

        first = lecturer.teach(p1.id, "gen-101")
        assert provider.calls == 1

        # A second player, a different level, AND a plant_id — none of it
        # should reach the provider or change the delivered content: HERMES's
        # "one canonical lesson per course" rule.
        second = lecturer.teach(
            p2.id, "gen-101", level="advanced", plant_id="not-a-real-plant"
        )
        assert provider.calls == 1  # still just the one generation, ever
        assert second.title == first.title
        assert second.content == first.content
        assert second.key_takeaways == first.key_takeaways


def test_second_call_for_same_course_returns_identical_saved_content(db):
    with session_scope() as s:
        p = GameService(s).create_player("repeat_learner")
        provider = _CountingLecturerProvider()
        lecturer = LecturerService(s, provider=provider)

        a = lecturer.teach(p.id, "gen-101")
        b = lecturer.teach(p.id, "gen-101")
        assert provider.calls == 1
        assert a.model_dump() == b.model_dump()
        # Exactly one row saved, not one per delivery.
        assert (
            s.query(LectureContent)
            .filter(LectureContent.course_key == "gen-101")
            .count()
            == 1
        )


def test_cache_miss_appends_one_lecture_delivered_knowledge_event(db):
    with session_scope() as s:
        p = GameService(s).create_player("kx_learner")
        lecturer = LecturerService(s, provider=MockLecturerProvider())
        lecturer.teach(p.id, "gen-101")
        lecturer.teach(p.id, "gen-101")  # cache hit — must NOT add a second event

        events = (
            s.query(KnowledgeEvent)
            .filter(KnowledgeEvent.event_type == "lecture_delivered")
            .all()
        )
        assert len(events) == 1
        assert events[0].payload["course_key"] == "gen-101"
        assert events[0].player_id == p.id
