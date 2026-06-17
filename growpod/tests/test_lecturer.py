"""GrowPod University Professor: CI-safe mock lecturer (no API key)."""

import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

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
