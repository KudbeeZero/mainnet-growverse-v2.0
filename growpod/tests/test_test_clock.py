"""
Simulation test clock (DEV/TEST ONLY).

Covers the OffsetClock primitive, the config gating (off by default, on with the
flag, force-disabled in production), the active_clock() selector, and the
/api/dev/clock endpoints — including the load-bearing invariant that advancing
grow time touches NO economy state.
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.config import Settings, get_settings
from growpodempire.db.models import LedgerEntry
from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService
from growpodempire.simulation import clock as clock_mod
from growpodempire.simulation.clock import (
    FrozenClock,
    OffsetClock,
    SystemClock,
    active_clock,
)


# --- OffsetClock primitive ---------------------------------------------------

def test_offset_clock_starts_at_base():
    base = FrozenClock(datetime(2025, 1, 1))
    oc = OffsetClock(base=base)
    assert oc.now() == datetime(2025, 1, 1)
    assert oc.offset == timedelta()


def test_offset_clock_advances_forward():
    base = FrozenClock(datetime(2025, 1, 1))
    oc = OffsetClock(base=base)
    oc.advance(days=2, hours=3)
    assert oc.now() == datetime(2025, 1, 3, 3)
    oc.advance(hours=1)
    assert oc.now() == datetime(2025, 1, 3, 4)
    assert oc.offset == timedelta(days=2, hours=4)


def test_offset_clock_rejects_backward():
    oc = OffsetClock(base=FrozenClock(datetime(2025, 1, 1)))
    with pytest.raises(ValueError):
        oc.advance(hours=-1)


def test_offset_clock_reset():
    base = FrozenClock(datetime(2025, 1, 1))
    oc = OffsetClock(base=base)
    oc.advance(days=10)
    oc.reset()
    assert oc.offset == timedelta()
    assert oc.now() == datetime(2025, 1, 1)


# --- Config gating -----------------------------------------------------------

def test_test_clock_off_by_default(monkeypatch):
    monkeypatch.delenv("GROW_TEST_CLOCK", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    assert Settings().test_clock_enabled is False


def test_test_clock_on_in_dev(monkeypatch):
    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "development")
    assert Settings().test_clock_enabled is True


def test_test_clock_force_disabled_in_production(monkeypatch):
    # Even with the flag explicitly on, production must refuse it.
    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "production")
    s = Settings()
    assert s.is_production is True
    assert s.test_clock_enabled is False


# --- active_clock() selector -------------------------------------------------

def test_active_clock_is_wall_when_disabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "test_clock_enabled", False, raising=False)
    assert isinstance(active_clock(), SystemClock)


def test_active_clock_is_shared_test_clock_when_enabled(monkeypatch):
    clock_mod.reset_test_clock()
    monkeypatch.setattr(get_settings(), "test_clock_enabled", True, raising=False)
    c = active_clock()
    assert isinstance(c, OffsetClock)
    # Same shared singleton each call.
    assert active_clock() is c
    clock_mod.reset_test_clock()


# --- API endpoints -----------------------------------------------------------

@pytest.fixture()
def enabled_client(db, monkeypatch):
    """A test client with the dev clock ENABLED (cache cleared, clock reset)."""
    from growpodempire.api.flask_api import create_app

    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    clock_mod.reset_test_clock()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        clock_mod.reset_test_clock()
        get_settings.cache_clear()


@pytest.fixture()
def disabled_client(db):
    """A default test client (dev clock disabled)."""
    from growpodempire.api.flask_api import create_app

    get_settings.cache_clear()
    return create_app(init_database=False).test_client()


def test_dev_routes_absent_when_disabled(disabled_client):
    # Blueprint isn't registered at all -> 404.
    assert disabled_client.get("/api/dev/clock").status_code == 404
    assert disabled_client.post("/api/dev/clock/advance", json={"hours": 1}).status_code == 404


def test_clock_status_when_enabled(enabled_client):
    body = enabled_client.get("/api/dev/clock").get_json()
    assert body["enabled"] is True
    assert body["offset_hours"] == 0.0


def test_advance_validates_input(enabled_client):
    assert enabled_client.post("/api/dev/clock/advance", json={"hours": 0}).status_code == 400
    assert enabled_client.post("/api/dev/clock/advance", json={"hours": -5}).status_code == 400
    assert enabled_client.post("/api/dev/clock/advance", json={"hours": 99999}).status_code == 400
    assert enabled_client.post("/api/dev/clock/advance", json={"hours": "soon"}).status_code == 400


def _make_plant(client):
    """Create a player + pod + planted seed via the public API; return ids+key."""
    p = client.post("/api/game/players", json={"username": "clockfarmer"}).get_json()
    pid, key = p["id"], p["api_key"]
    hdr = {"X-API-Key": key}
    sid = client.get("/api/game/strains").get_json()[0]["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent", "capacity": 4}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return pid, key, plant["id"]


def test_advance_progresses_a_plant(enabled_client):
    pid, key, plant_id = _make_plant(enabled_client)
    hdr = {"X-API-Key": key}

    state0 = enabled_client.get(
        f"/api/game/players/{pid}/plants/{plant_id}/state", headers=hdr
    ).get_json()
    assert state0["growth_stage"] == "seed"

    # Jump 10 days: clears the 3-day seed stage many times over.
    adv = enabled_client.post("/api/dev/clock/advance", json={"days": 10}).get_json()
    assert adv["offset_hours"] == pytest.approx(240.0)
    assert adv["synced_plants"] >= 1

    state1 = enabled_client.get(
        f"/api/game/players/{pid}/plants/{plant_id}/state", headers=hdr
    ).get_json()
    assert state1["growth_stage"] != "seed"


def test_advance_does_not_touch_the_economy(enabled_client):
    """The load-bearing invariant: fast-forwarding time mutates NO money."""
    pid, key, plant_id = _make_plant(enabled_client)

    with session_scope() as s:
        before_balance = balance(s, pid)
        before_entries = s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count()

    enabled_client.post("/api/dev/clock/advance", json={"days": 30})

    with session_scope() as s:
        after_balance = balance(s, pid)
        after_entries = s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count()

    assert after_balance == before_balance
    assert after_entries == before_entries


def test_reset_returns_offset_to_zero(enabled_client):
    enabled_client.post("/api/dev/clock/advance", json={"days": 5})
    assert enabled_client.get("/api/dev/clock").get_json()["offset_hours"] == pytest.approx(120.0)
    body = enabled_client.post("/api/dev/clock/reset").get_json()
    assert body["offset_hours"] == 0.0
