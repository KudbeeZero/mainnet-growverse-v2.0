"""Unit tests for the REAL Claude provider classes (ai/claude.py,
ai/lecturer_claude.py) by monkeypatching the Anthropic SDK boundary.

No live key, no network: a fake `anthropic` module is injected into
sys.modules so the lazy `import anthropic` inside the providers resolves to a
stub whose `messages.parse(...)` returns a canned response object matching the
shape the providers read (`response.parsed_output`). These tests exercise the
request-build + response-parse + error-handling logic only — they never reach
the real API.
"""

import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.ai.claude import ClaudeAdvisorProvider
from growpodempire.ai.lecturer_claude import ClaudeLecturerProvider
from growpodempire.ai.provider import (
    AdvisorError,
    AdvisorReport,
    CareSuggestion,
    LectureReport,
)


# ----- fake anthropic SDK -------------------------------------------------
class _FakeMessages:
    """Stand-in for client.messages — records the parse() kwargs and returns a
    canned response (or raises) per how the fake is configured."""

    def __init__(self, parsed_output=None, raise_exc=None):
        self._parsed_output = parsed_output
        self._raise_exc = raise_exc
        self.last_kwargs = None

    def parse(self, **kwargs):
        self.last_kwargs = kwargs
        if self._raise_exc is not None:
            raise self._raise_exc
        return types.SimpleNamespace(parsed_output=self._parsed_output)


class _FakeAnthropic:
    """Stand-in for anthropic.Anthropic. Captures the api_key it was built with
    and exposes a `.messages` object the test controls."""

    last_instance = None

    def __init__(self, api_key=None):
        self.api_key = api_key
        # configured per-test via the class-level template
        self.messages = type(self)._messages_template
        _FakeAnthropic.last_instance = self


def _install_fake_anthropic(monkeypatch, messages):
    """Inject a fake `anthropic` module whose Anthropic() yields a client with
    the given fake `messages`."""
    fake_module = types.ModuleType("anthropic")

    class _Client(_FakeAnthropic):
        _messages_template = messages

    fake_module.Anthropic = _Client
    monkeypatch.setitem(sys.modules, "anthropic", fake_module)
    return _Client


def _advisor_report():
    return AdvisorReport(
        summary="Water the plant now.",
        severity="serious",
        diagnosis="Water level is critically low.",
        suggestions=[
            CareSuggestion(action="water", urgency="now", reason="Soil is dry."),
        ],
    )


def _lecture_report():
    return LectureReport(
        title="Inheritance Basics",
        summary="An intro to Mendelian inheritance in cannabis.",
        content="Lecture body covering dominant/recessive alleles...",
        key_takeaways=["Alleles segregate", "Phenotype != genotype"],
        quiz_question="What is a Punnett square?",
    )


# ----- constructor guards -------------------------------------------------
def test_advisor_requires_api_key():
    with pytest.raises(AdvisorError, match="ANTHROPIC_API_KEY is required"):
        ClaudeAdvisorProvider(api_key="")


def test_lecturer_requires_api_key():
    with pytest.raises(AdvisorError, match="ANTHROPIC_API_KEY is required"):
        ClaudeLecturerProvider(api_key="")


# ----- advisor: happy path ------------------------------------------------
def test_advisor_builds_request_and_parses_report(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(parsed_output=_advisor_report())
    client_cls = _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeAdvisorProvider(api_key="test-key", model="claude-opus-4-8")
    assert provider.name() == "claude:claude-opus-4-8"
    # the fake client was constructed with the key
    assert client_cls.last_instance.api_key == "test-key"

    context = {"plant": {"water_level": 5}, "genome": {}, "environment": {}}
    report = provider.diagnose(context)

    assert isinstance(report, AdvisorReport)
    assert report.severity == "serious"
    assert report.suggestions[0].action == "water"

    # the request was built with the expected shape
    kw = messages.last_kwargs
    assert kw["model"] == "claude-opus-4-8"
    assert kw["output_format"] is AdvisorReport
    assert kw["thinking"] == {"type": "adaptive"}
    assert kw["max_tokens"] == 16000
    assert kw["system"]  # non-empty system prompt
    # context is serialized to JSON in the user turn
    assert kw["messages"][0]["role"] == "user"
    assert '"water_level": 5' in kw["messages"][0]["content"]


def test_advisor_serializes_non_json_context(monkeypatch):
    """default=str path: a non-JSON-native value must not blow up the request."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(parsed_output=_advisor_report())
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeAdvisorProvider(api_key="test-key")
    from datetime import datetime

    provider.diagnose({"when": datetime(2025, 1, 1)})
    assert "2025-01-01" in messages.last_kwargs["messages"][0]["content"]


# ----- advisor: error branches --------------------------------------------
def test_advisor_wraps_backend_exception(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    boom = RuntimeError("rate limited")
    boom.request_id = "req_123"  # exercise the request_id-logging branch
    messages = _FakeMessages(raise_exc=boom)
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeAdvisorProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="advisor backend error"):
        provider.diagnose({})


def test_advisor_wraps_backend_exception_without_request_id(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(raise_exc=ValueError("boom"))  # no request_id attr
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeAdvisorProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="advisor backend error"):
        provider.diagnose({})


def test_advisor_raises_on_empty_structured_output(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(parsed_output=None)
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeAdvisorProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="no structured output"):
        provider.diagnose({})


# ----- lecturer: happy path -----------------------------------------------
def test_lecturer_builds_request_and_parses_report(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(parsed_output=_lecture_report())
    client_cls = _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeLecturerProvider(api_key="test-key", model="claude-opus-4-8")
    assert provider.name() == "claude:claude-opus-4-8"
    assert client_cls.last_instance.api_key == "test-key"

    context = {"course": "Genetics", "topic": "Inheritance", "level": "beginner"}
    report = provider.lecture(context)

    assert isinstance(report, LectureReport)
    assert report.title == "Inheritance Basics"
    assert report.key_takeaways

    kw = messages.last_kwargs
    assert kw["model"] == "claude-opus-4-8"
    assert kw["output_format"] is LectureReport
    assert kw["thinking"] == {"type": "adaptive"}
    assert kw["max_tokens"] == 8000
    assert kw["system"]
    assert kw["messages"][0]["role"] == "user"
    assert '"Inheritance"' in kw["messages"][0]["content"]


# ----- lecturer: error branches -------------------------------------------
def test_lecturer_wraps_backend_exception(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    boom = RuntimeError("server error")
    boom.request_id = "req_999"
    messages = _FakeMessages(raise_exc=boom)
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeLecturerProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="lecturer backend error"):
        provider.lecture({})


def test_lecturer_wraps_backend_exception_without_request_id(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(raise_exc=ValueError("boom"))
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeLecturerProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="lecturer backend error"):
        provider.lecture({})


def test_lecturer_raises_on_empty_structured_output(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    messages = _FakeMessages(parsed_output=None)
    _install_fake_anthropic(monkeypatch, messages)

    provider = ClaudeLecturerProvider(api_key="test-key")
    with pytest.raises(AdvisorError, match="no structured output"):
        provider.lecture({})
