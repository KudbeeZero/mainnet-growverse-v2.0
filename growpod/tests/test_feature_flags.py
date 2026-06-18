"""Feature-flag layer: yaml defaults, env overrides, the guard, and the endpoint."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app
from growpodempire.feature_flags import (
    FeatureDisabledError,
    all_flags,
    feature_required,
    is_enabled,
    require_feature,
)


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_defaults_come_from_balance_yaml():
    flags = all_flags()
    # The launch surfaces declared in balance.yaml, all defaulting on.
    assert flags["ftue_tutorial"] is True
    assert flags["grow_chamber"] is True
    assert flags["marketplace"] is True
    assert is_enabled("ftue_tutorial") is True


def test_unknown_flag_fails_closed():
    assert is_enabled("does_not_exist") is False
    assert "does_not_exist" not in all_flags()


def test_env_override_disables(monkeypatch):
    monkeypatch.setenv("FEATURE_FTUE_TUTORIAL", "false")
    assert is_enabled("ftue_tutorial") is False
    assert all_flags()["ftue_tutorial"] is False


def test_env_override_token_variants(monkeypatch):
    monkeypatch.setenv("FEATURE_MARKETPLACE", "off")
    assert is_enabled("marketplace") is False
    monkeypatch.setenv("FEATURE_MARKETPLACE", "ON")
    assert is_enabled("marketplace") is True
    monkeypatch.setenv("FEATURE_MARKETPLACE", "1")
    assert is_enabled("marketplace") is True


def test_unrecognised_override_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("FEATURE_GROW_CHAMBER", "maybe")
    # Garbage value is ignored — the yaml default (True) stands.
    assert is_enabled("grow_chamber") is True


def test_env_can_enable_a_flag_defaulted_off(monkeypatch):
    # An undeclared flag is off by default, but an explicit env override wins.
    assert is_enabled("experimental_thing") is False
    monkeypatch.setenv("FEATURE_EXPERIMENTAL_THING", "true")
    assert is_enabled("experimental_thing") is True


def test_require_feature_guard(monkeypatch):
    require_feature("marketplace")  # enabled by default — no raise
    monkeypatch.setenv("FEATURE_MARKETPLACE", "false")
    with pytest.raises(FeatureDisabledError):
        require_feature("marketplace")


def test_feature_required_decorator(monkeypatch):
    @feature_required("breeding_lab")
    def view():
        return "ok"

    assert view() == "ok"
    monkeypatch.setenv("FEATURE_BREEDING_LAB", "false")
    with pytest.raises(FeatureDisabledError):
        view()


def test_economy_flag_declared_and_default_on():
    # The master economy kill-switch is declared in balance.yaml and defaults ON,
    # so introducing it changes NO current behavior. Default ON is NOT live-economy
    # approval — it merely preserves the existing free-playtest behavior.
    flags = all_flags()
    assert "economy" in flags
    assert flags["economy"] is True
    assert is_enabled("economy") is True


def test_economy_flag_toggles_via_env(monkeypatch):
    # OFF freezes the economy; the guard raises so gated routes can 404.
    monkeypatch.setenv("FEATURE_ECONOMY", "false")
    assert is_enabled("economy") is False
    with pytest.raises(FeatureDisabledError):
        require_feature("economy")
    # Explicit ON works too.
    monkeypatch.setenv("FEATURE_ECONOMY", "true")
    assert is_enabled("economy") is True
    require_feature("economy")  # no raise


def test_flags_endpoint(client):
    r = client.get("/api/game/flags")
    assert r.status_code == 200
    flags = r.get_json()["flags"]
    assert flags["ftue_tutorial"] is True
    assert isinstance(flags, dict)


def test_flags_endpoint_reflects_env_override(client, monkeypatch):
    monkeypatch.setenv("FEATURE_MARKETPLACE", "false")
    r = client.get("/api/game/flags")
    assert r.status_code == 200
    assert r.get_json()["flags"]["marketplace"] is False
