"""Pre-launch FACTION + launch waitlist (NON-ECONOMIC).

The load-bearing guarantee under test is that joining a waitlist, accruing
engagement points, and reading standings NEVER touch the GROW ledger or a wallet:
``engagement_points`` is a self-contained tally, and the stored Algorand address
is just a string for a future reward (no on-chain action).

Layers covered:
  * the cached faction catalog loader (``factions.load_factions`` / ``faction_ids``);
  * service ``join`` (creates a row; dedupes/upserts by address; rejects an
    unknown faction or a malformed Algorand address; accepts a valid address) —
    deterministic via a FrozenClock and ledger-free;
  * ``standings`` counts per faction + total (zero-filled);
  * the HTTP routes: gated OFF -> 404, gated ON -> work, and POST happy path 201.
"""

import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import LedgerEntry, WaitlistSignup
from growpodempire.economy.ledger import balance
from growpodempire.simulation.clock import FrozenClock
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.factions import faction_ids, load_factions
from growpodempire.services.waitlist_service import WaitlistService


# Deterministic, well-formed Algorand addresses (encoded zero/one/two pubkeys),
# valid under algosdk.encoding.is_valid_address — no live keys, CI-safe.
ADDR_A = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
ADDR_B = "AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKE3PRHE"
FROZEN = FrozenClock(datetime(2026, 6, 26, 12, 0, 0))


# ===== faction catalog =======================================================


def test_faction_ids_are_the_four_houses():
    assert faction_ids() == {"frostwardens", "sunseekers", "loomkeepers", "alchemists"}
    cat = load_factions()["factions"]
    assert [f["id"] for f in cat] == ["frostwardens", "sunseekers", "loomkeepers", "alchemists"]
    assert cat[0]["name"] == "The Frostwardens"


# ===== service: join =========================================================


def test_join_creates_a_row(db):
    with session_scope() as s:
        out = WaitlistService(s, clock=FROZEN).join(
            faction="frostwardens", email="a@example.com"
        )
        assert out["faction"] == "frostwardens"
        assert out["email"] == "a@example.com"
        assert out["engagement_points"] == 0
        assert out["algorand_address"] is None
        assert "id" in out and out["created_at"] is not None

    with session_scope() as s:
        assert s.query(WaitlistSignup).count() == 1


def test_join_with_existing_address_updates_faction_no_duplicate(db):
    with session_scope() as s:
        first = WaitlistService(s).join(faction="frostwardens", algorand_address=ADDR_A)
        first_id = first["id"]

    with session_scope() as s:
        second = WaitlistService(s).join(faction="loomkeepers", algorand_address=ADDR_A)
        # Same row, faction switched — no duplicate created.
        assert second["id"] == first_id
        assert second["faction"] == "loomkeepers"

    with session_scope() as s:
        rows = s.query(WaitlistSignup).all()
        assert len(rows) == 1
        assert rows[0].faction == "loomkeepers"


def test_join_with_existing_email_dedupes(db):
    with session_scope() as s:
        WaitlistService(s).join(faction="sunseekers", email="dup@example.com")
    with session_scope() as s:
        WaitlistService(s).join(faction="loomkeepers", email="dup@example.com")
    with session_scope() as s:
        rows = s.query(WaitlistSignup).filter(
            WaitlistSignup.email == "dup@example.com"
        ).all()
        assert len(rows) == 1
        assert rows[0].faction == "loomkeepers"


def test_join_rejects_unknown_faction(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            WaitlistService(s).join(faction="kush")


def test_join_rejects_invalid_algorand_address(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            WaitlistService(s).join(faction="frostwardens", algorand_address="not-an-addr")


def test_join_accepts_valid_algorand_address(db):
    with session_scope() as s:
        out = WaitlistService(s).join(faction="frostwardens", algorand_address=ADDR_B)
        assert out["algorand_address"] == ADDR_B


# ===== service: engagement + standings =======================================


def test_add_engagement_accrues_clamped_points(db):
    with session_scope() as s:
        out = WaitlistService(s).join(faction="frostwardens", algorand_address=ADDR_A)
        sid = out["id"]
    with session_scope() as s:
        out = WaitlistService(s).add_engagement(signup_id=sid, points=5)
        assert out["engagement_points"] == 5
        # Negative points are clamped to a no-op.
        out = WaitlistService(s).add_engagement(signup_id=sid, points=-3)
        assert out["engagement_points"] == 5


def test_add_engagement_missing_signup_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            WaitlistService(s).add_engagement(email="nobody@example.com", points=1)


def test_standings_counts_per_faction_and_total(db):
    with session_scope() as s:
        svc = WaitlistService(s)
        svc.join(faction="frostwardens", algorand_address=ADDR_A)
        svc.join(faction="frostwardens", email="i2@example.com")
        svc.join(faction="loomkeepers", email="h1@example.com")
    with session_scope() as s:
        st = WaitlistService(s).standings()
        assert st["factions"] == {"frostwardens": 2, "sunseekers": 0, "loomkeepers": 1, "alchemists": 0}
        assert st["total"] == 3


# ===== ledger-free guarantee =================================================


def test_join_does_not_touch_the_ledger(db):
    # A real player exists so a wallet/ledger is in play; the waitlist must not
    # add any ledger rows or move any balance.
    with session_scope() as s:
        pid = GameService(s).create_player("waitlist_ledger").id
    with session_scope() as s:
        bal_before = balance(s, pid)
        ledger_before = s.query(LedgerEntry).count()

    with session_scope() as s:
        WaitlistService(s).join(faction="frostwardens", algorand_address=ADDR_A)
        WaitlistService(s).add_engagement(algorand_address=ADDR_A, points=10)

    with session_scope() as s:
        assert balance(s, pid) == bal_before
        assert s.query(LedgerEntry).count() == ledger_before


# ===== HTTP routes ===========================================================


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def test_factions_route_serves_catalog(client):
    r = client.get("/api/game/factions")
    assert r.status_code == 200
    ids = [f["id"] for f in r.get_json()["factions"]]
    assert ids == ["frostwardens", "sunseekers", "loomkeepers", "alchemists"]


def test_join_route_happy_path_returns_201(client):
    r = client.post(
        "/api/game/waitlist",
        json={"faction": "loomkeepers", "algorand_address": ADDR_A, "email": "x@example.com"},
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["faction"] == "loomkeepers"
    assert body["algorand_address"] == ADDR_A
    assert body["engagement_points"] == 0


def test_join_route_missing_faction_400(client):
    r = client.post("/api/game/waitlist", json={})
    assert r.status_code == 400


def test_join_route_invalid_address_400(client):
    r = client.post(
        "/api/game/waitlist", json={"faction": "frostwardens", "algorand_address": "nope"}
    )
    assert r.status_code == 400


def test_standings_route_reports_counts(client):
    client.post("/api/game/waitlist", json={"faction": "sunseekers", "email": "s@example.com"})
    r = client.get("/api/game/waitlist/standings")
    assert r.status_code == 200
    st = r.get_json()
    assert st["factions"]["sunseekers"] == 1
    assert st["total"] == 1


def test_routes_404_when_feature_disabled(client, monkeypatch):
    monkeypatch.setenv("FEATURE_FACTION_WAITLIST", "false")
    assert client.get("/api/game/factions").status_code == 404
    assert client.post("/api/game/waitlist", json={"faction": "frostwardens"}).status_code == 404
    assert client.get("/api/game/waitlist/standings").status_code == 404
