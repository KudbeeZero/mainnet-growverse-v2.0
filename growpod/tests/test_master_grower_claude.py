"""Unit tests for the REAL Claude Master Grower (ai/master_grower_claude.py).

Same approach as test_claude_providers.py: a fake `anthropic` module is
injected so the lazy import resolves to a stub — no key, no network. Covers:
constructor guard, grounding pre-fetch (sources reach the request payload),
tool-failure degradation, response parsing, backend-error wrapping, and the
factory returning the real provider when a key is set (mock otherwise).
"""

import json
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.ai.master_grower_claude import ClaudeMasterGrower
from growpodempire.ai.provider import (
    AdvisorError,
    AdvisorReport,
    Citation,
    MasterGrowerReport,
)


class _FakeMessages:
    def __init__(self, parsed_output=None, raise_exc=None):
        self._parsed_output = parsed_output
        self._raise_exc = raise_exc
        self.last_kwargs = None

    def parse(self, **kwargs):
        self.last_kwargs = kwargs
        if self._raise_exc is not None:
            raise self._raise_exc
        return types.SimpleNamespace(parsed_output=self._parsed_output)


def _install_fake_anthropic(monkeypatch, messages):
    fake_module = types.ModuleType("anthropic")

    class _Client:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.messages = messages

    fake_module.Anthropic = _Client
    monkeypatch.setitem(sys.modules, "anthropic", fake_module)


class _Tools:
    """Minimal MasterGrowerTools double with controllable failures."""

    def __init__(self, player_id=None, plant_id=None, fail=()):
        self.player_id = player_id
        self.plant_id = plant_id
        self._fail = set(fail)

    def get_plant_state(self, player_id, plant_id):
        if "plant" in self._fail:
            raise RuntimeError("boom")
        return {"stage": "flowering", "health": 88}

    def diagnose_plant(self, player_id, plant_id):
        if "diagnose" in self._fail:
            raise RuntimeError("boom")
        return AdvisorReport(
            summary="Healthy.", severity="healthy", diagnosis="No issues.", suggestions=[]
        )

    def lookup_strain(self, query):
        if "strain" in self._fail:
            raise RuntimeError("boom")
        return {"name": "Blue Dream", "flowering_days": 65}

    def search_knowledge(self, query):
        if "knowledge" in self._fail:
            raise RuntimeError("boom")
        return [{"slug": "watering-101", "snippet": "Water when the topsoil dries."}]


def _report():
    return MasterGrowerReport(
        answer="Blue Dream flowers in about 65 days.",
        citations=[Citation(source="strain", snippet="flowering_days: 65")],
    )


def test_requires_api_key():
    with pytest.raises(AdvisorError, match="ANTHROPIC_API_KEY"):
        ClaudeMasterGrower(api_key="")


def test_answer_grounds_sources_and_parses(monkeypatch):
    messages = _FakeMessages(parsed_output=_report())
    _install_fake_anthropic(monkeypatch, messages)
    p = ClaudeMasterGrower(api_key="k")
    report = p.answer("How long does Blue Dream flower?", _Tools("pl1", "pt1"))

    assert report.answer.startswith("Blue Dream")
    payload = json.loads(messages.last_kwargs["messages"][0]["content"])
    assert payload["question"] == "How long does Blue Dream flower?"
    # All four sources were pre-fetched into the request.
    assert payload["sources"]["plant_state"]["stage"] == "flowering"
    assert payload["sources"]["diagnosis"]["summary"] == "Healthy."
    assert payload["sources"]["strain"]["name"] == "Blue Dream"
    assert payload["sources"]["knowledge"][0]["slug"] == "watering-101"
    # Cheap model by default, structured output requested.
    assert "haiku" in messages.last_kwargs["model"]
    assert messages.last_kwargs["output_format"] is MasterGrowerReport


def test_tool_failures_degrade_to_absent_sources(monkeypatch):
    messages = _FakeMessages(parsed_output=_report())
    _install_fake_anthropic(monkeypatch, messages)
    p = ClaudeMasterGrower(api_key="k")
    p.answer("q", _Tools("pl1", "pt1", fail=("plant", "diagnose", "strain", "knowledge")))
    payload = json.loads(messages.last_kwargs["messages"][0]["content"])
    assert payload["sources"] == {}  # degraded, not raised


def test_no_plant_scope_skips_plant_tools(monkeypatch):
    messages = _FakeMessages(parsed_output=_report())
    _install_fake_anthropic(monkeypatch, messages)
    p = ClaudeMasterGrower(api_key="k")
    p.answer("q", _Tools())  # no player/plant ids
    payload = json.loads(messages.last_kwargs["messages"][0]["content"])
    assert "plant_state" not in payload["sources"]
    assert "diagnosis" not in payload["sources"]


def test_backend_error_wraps_as_advisor_error(monkeypatch):
    messages = _FakeMessages(raise_exc=RuntimeError("api down"))
    _install_fake_anthropic(monkeypatch, messages)
    p = ClaudeMasterGrower(api_key="k")
    with pytest.raises(AdvisorError, match="master grower backend error"):
        p.answer("q", _Tools())


def test_empty_structured_output_raises(monkeypatch):
    messages = _FakeMessages(parsed_output=None)
    _install_fake_anthropic(monkeypatch, messages)
    p = ClaudeMasterGrower(api_key="k")
    with pytest.raises(AdvisorError, match="no structured output"):
        p.answer("q", _Tools())


def test_factory_returns_claude_with_key_and_mock_without(monkeypatch):
    from growpodempire.ai import factory
    from growpodempire.ai.master_grower_mock import MockMasterGrower

    messages = _FakeMessages(parsed_output=_report())
    _install_fake_anthropic(monkeypatch, messages)

    class _S:
        use_mock_ai = False
        anthropic_api_key = "k"
        master_grower_model = "claude-haiku-4-5-20251001"

    assert isinstance(factory.get_master_grower_provider(_S()), ClaudeMasterGrower)

    class _NoKey(_S):
        anthropic_api_key = None

    assert isinstance(factory.get_master_grower_provider(_NoKey()), MockMasterGrower)

    class _ForcedMock(_S):
        use_mock_ai = True

    assert isinstance(factory.get_master_grower_provider(_ForcedMock()), MockMasterGrower)
