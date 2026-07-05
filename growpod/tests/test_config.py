"""Unit tests for growpodempire.config.Settings env parsing edge cases."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.config import Settings


def test_max_withdrawal_per_day_empty_env_falls_back_to_default(monkeypatch):
    """SECURITY (2026-07-05 audit): MAX_WITHDRAWAL_PER_DAY="" (e.g. from an
    emptied Fly secret) must fall back to the safe default, not silently
    disable the treasury withdrawal cap."""
    monkeypatch.setenv("MAX_WITHDRAWAL_PER_DAY", "")
    assert Settings().max_withdrawal_per_day == "10000"


def test_max_withdrawal_per_day_unset_uses_default(monkeypatch):
    monkeypatch.delenv("MAX_WITHDRAWAL_PER_DAY", raising=False)
    assert Settings().max_withdrawal_per_day == "10000"


def test_max_withdrawal_per_day_explicit_zero_disables_cap(monkeypatch):
    monkeypatch.setenv("MAX_WITHDRAWAL_PER_DAY", "0")
    assert Settings().max_withdrawal_per_day == "0"


def test_max_withdrawal_per_day_explicit_value_honored(monkeypatch):
    monkeypatch.setenv("MAX_WITHDRAWAL_PER_DAY", "500")
    assert Settings().max_withdrawal_per_day == "500"
