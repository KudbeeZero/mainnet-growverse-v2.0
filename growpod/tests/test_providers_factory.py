"""Provider-SELECTION coverage for the AI and chain factories.

These tests exercise *which* provider each factory returns under different
configuration, plus the remaining branches of the deterministic mock advisor.
They never call a live API: the "real provider selected" branches only assert
the returned object's TYPE/identity (constructors here make no network call),
and every other path uses the offline mocks. No live key is required.

Mirrors the env-driven, cache-clearing patterns in test_advisor.py /
test_lecturer.py / test_chain.py.
"""

import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.config import get_settings
from growpodempire.ai import factory as ai_factory
from growpodempire.ai.mock import MockAdvisorProvider
from growpodempire.ai.lecturer_mock import MockLecturerProvider
from growpodempire.ai.autocare import (
    MockAutoCareProvider,
    AutoCareBudget,
    ActionRecord,
)
from growpodempire.ai.claude import ClaudeAdvisorProvider
from growpodempire.ai.lecturer_claude import ClaudeLecturerProvider
from growpodempire.ai.provider import AdvisorReport
from growpodempire.chain import factory as chain_factory
from growpodempire.chain.mock import MockChainProvider
from growpodempire.chain.algorand import AlgorandProvider


def _settings(**over):
    base = dict(
        use_mock_ai=False,
        anthropic_api_key=None,
        advisor_model="claude-opus-4-8",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _valid_mnemonic():
    """A freshly generated, syntactically valid 25-word mnemonic.

    Generated at runtime so nothing secret-looking is committed; it is never
    used against a network — only to satisfy AlgorandProvider's constructor.
    """
    from algosdk import account, mnemonic

    sk, _addr = account.generate_account()
    return mnemonic.from_private_key(sk)


# ===== ai/factory.py: advisor selection ===================================
def test_advisor_factory_returns_mock_without_key():
    provider = ai_factory.get_advisor_provider(_settings())
    assert isinstance(provider, MockAdvisorProvider)


def test_advisor_factory_returns_mock_when_use_mock_ai():
    provider = ai_factory.get_advisor_provider(
        _settings(use_mock_ai=True, anthropic_api_key="sk-ant-xxx")
    )
    assert isinstance(provider, MockAdvisorProvider)


def test_advisor_factory_returns_real_claude_with_key():
    # Real path (lines 25-27): lazy import + ClaudeAdvisorProvider, by TYPE only.
    provider = ai_factory.get_advisor_provider(
        _settings(anthropic_api_key="sk-ant-test")
    )
    assert isinstance(provider, ClaudeAdvisorProvider)


# ===== ai/factory.py: lecturer selection ==================================
def test_lecturer_factory_returns_mock_without_key():
    provider = ai_factory.get_lecturer_provider(_settings())
    assert isinstance(provider, MockLecturerProvider)


def test_lecturer_factory_returns_real_claude_with_key():
    # Real path (lines 53-54): lazy import + ClaudeLecturerProvider, TYPE only.
    provider = ai_factory.get_lecturer_provider(
        _settings(anthropic_api_key="sk-ant-test")
    )
    assert isinstance(provider, ClaudeLecturerProvider)


# ===== ai/factory.py: auto-care selection =================================
def test_auto_care_factory_returns_mock_without_key():
    provider = ai_factory.get_auto_care_provider(_settings())
    assert isinstance(provider, MockAutoCareProvider)


def test_auto_care_factory_returns_real_claude_with_key():
    # Real path (lines 78-79): lazy import + ClaudeAutoCareProvider, TYPE only.
    from growpodempire.ai.autocare import ClaudeAutoCareProvider

    provider = ai_factory.get_auto_care_provider(
        _settings(anthropic_api_key="sk-ant-test")
    )
    assert isinstance(provider, ClaudeAutoCareProvider)


# ===== ai/factory.py: shared singletons + default settings path ===========
def test_advisor_factory_default_settings_via_env(monkeypatch):
    # Drive the `settings or get_settings()` branch (line 19/46) + reset
    # singleton; force mock so no key is ever needed.
    monkeypatch.setenv("USE_MOCK_AI", "true")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    ai_factory.reset_shared_advisor()
    ai_factory.reset_shared_lecturer()
    try:
        adv = ai_factory.shared_advisor()
        assert isinstance(adv, MockAdvisorProvider)
        # Second call returns the cached singleton (same identity).
        assert ai_factory.shared_advisor() is adv

        lec = ai_factory.shared_lecturer()
        assert isinstance(lec, MockLecturerProvider)
        assert ai_factory.shared_lecturer() is lec
    finally:
        ai_factory.reset_shared_advisor()
        ai_factory.reset_shared_lecturer()
        get_settings.cache_clear()


# ===== ai/mock.py: remaining advisor branches =============================
def _ctx(**plant):
    base = {
        "growth_stage": "vegetative",
        "health": 100,
        "water_level": 60,
        "nutrient_level": 60,
        "pest_level": 0,
        "disease_level": 0,
    }
    base.update(plant)
    return {"plant": base, "genome": {}, "environment": {}, "recent_events": []}


def test_mock_low_water_soon_band():
    # Lines 37-41: 25 <= water < 40 -> "soon".
    report = MockAdvisorProvider().diagnose(_ctx(water_level=30))
    waters = [s for s in report.suggestions if s.action == "water"]
    assert waters and waters[0].urgency == "soon"


def test_mock_overwatering_finding():
    # Line 43: water > 90 adds an overwatering finding (no water suggestion).
    report = MockAdvisorProvider().diagnose(_ctx(water_level=95))
    assert any("overwater" in f.lower() for f in [report.diagnosis, report.summary])
    assert not [s for s in report.suggestions if s.action == "water"]


def test_mock_low_nutrient_soon_band():
    # Line 52: 25 <= nutrient < 40 -> feed "soon".
    report = MockAdvisorProvider().diagnose(_ctx(nutrient_level=30))
    feeds = [s for s in report.suggestions if s.action == "feed"]
    assert feeds and feeds[0].urgency == "soon"


def test_mock_harvest_suggested_at_harvest_stage():
    # Line 74: stage == "harvest" -> harvest suggestion.
    report = MockAdvisorProvider().diagnose(_ctx(growth_stage="harvest"))
    assert any(s.action == "harvest" for s in report.suggestions)


def test_mock_harvest_suggested_when_flowering_and_healthy():
    # Line 74 (other arm): flowering + health >= 70 + no findings.
    report = MockAdvisorProvider().diagnose(
        _ctx(growth_stage="flowering", health=85)
    )
    assert any(s.action == "harvest" for s in report.suggestions)


def test_mock_critical_severity_on_low_health():
    # Line 86: health <= 20 -> "critical".
    report = MockAdvisorProvider().diagnose(_ctx(health=10))
    assert report.severity == "critical"


def test_mock_minor_severity_single_finding_high_health():
    # Line 90: a single finding with health > 50 -> "minor".
    report = MockAdvisorProvider().diagnose(_ctx(water_level=30, health=90))
    assert report.severity == "minor"


def test_mock_advisor_satisfies_provider_contract():
    assert MockAdvisorProvider().name() == "mock"
    assert isinstance(MockAdvisorProvider().diagnose(_ctx()), AdvisorReport)


# ===== ai/autocare.py mock loop (exercises CareTools branches) ============
class _StubTools:
    """Minimal CareTools stub: returns a scripted snapshot then resolves."""

    def __init__(self, snapshots):
        self._snapshots = list(snapshots)
        self._actions = 5

    def snapshot(self):
        return self._snapshots.pop(0) if self._snapshots else {}

    def actions_remaining(self):
        return self._actions

    def remaining_budget(self):
        return 1000.0

    def _do(self, action):
        self._actions -= 1
        return ActionRecord(action=action, ok=True, cost=1.0, detail="ok")

    def water(self, amount=None):
        return self._do("water")

    def feed(self):
        return self._do("feed")

    def treat_pests(self):
        return self._do("treat_pests")

    def treat_disease(self):
        return self._do("treat_disease")


def test_mock_auto_care_runs_priority_loop():
    # Walk pests -> disease -> feed -> water -> healthy (break).
    tools = _StubTools(
        [
            {"pest_level": 3},
            {"disease_level": 3},
            {"nutrient_level": 20},
            {"water_level": 20},
            {"water_level": 80, "nutrient_level": 80},
        ]
    )
    summary = MockAutoCareProvider().run(
        {}, tools, AutoCareBudget(max_grow=1000, max_actions=5)
    )
    assert "treat_pests" in summary and "water" in summary


def test_mock_auto_care_noop_when_healthy():
    tools = _StubTools([{"water_level": 90, "nutrient_level": 90}])
    summary = MockAutoCareProvider().run(
        {}, tools, AutoCareBudget(max_grow=1000, max_actions=5)
    )
    assert "no action" in summary.lower()


# ===== chain/factory.py: provider selection ===============================
def test_chain_factory_returns_mock_without_mnemonic():
    settings = SimpleNamespace(
        use_mock_chain=False,
        algo_treasury_mnemonic=None,
        algod_url="https://x",
        algod_token="",
        algorand_network="testnet",
    )
    assert isinstance(chain_factory.get_chain_provider(settings), MockChainProvider)


def test_chain_factory_returns_mock_when_use_mock_chain():
    settings = SimpleNamespace(
        use_mock_chain=True,
        algo_treasury_mnemonic=_valid_mnemonic(),
        algod_url="https://x",
        algod_token="",
        algorand_network="testnet",
    )
    assert isinstance(chain_factory.get_chain_provider(settings), MockChainProvider)


def test_chain_factory_returns_real_algorand_with_mnemonic():
    # Real path (lines 24-26): lazy import + AlgorandProvider, by TYPE only.
    # The mnemonic is generated locally and never used against a network.
    settings = SimpleNamespace(
        use_mock_chain=False,
        algo_treasury_mnemonic=_valid_mnemonic(),
        algod_url="https://testnet-api.algonode.cloud",
        algod_token="",
        algorand_network="testnet",
    )
    provider = chain_factory.get_chain_provider(settings)
    assert isinstance(provider, AlgorandProvider)
    assert provider.network() == "testnet"


def test_chain_factory_default_settings_via_env(monkeypatch):
    # `settings or get_settings()` branch + singleton reset; force mock so no
    # secret is required.
    monkeypatch.setenv("USE_MOCK_CHAIN", "true")
    monkeypatch.delenv("ALGO_TREASURY_MNEMONIC", raising=False)
    get_settings.cache_clear()
    chain_factory.reset_shared_provider()
    try:
        prov = chain_factory.shared_provider()
        assert isinstance(prov, MockChainProvider)
        # Singleton identity preserved across calls.
        assert chain_factory.shared_provider() is prov
    finally:
        chain_factory.reset_shared_provider()
        get_settings.cache_clear()
