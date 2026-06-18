"""Seasonal strain drops — the monthly exclusive token sink.

Covers SeasonalService (upsert/list/purchase/delete/rollover) at the service
layer plus the public + admin HTTP routes. Purchasing a seasonal seed is a
launch-critical economy sink (price_gc debited via the ledger), so the
debit/insufficient-funds/availability paths are guarded here.
"""

import os
import sys
from datetime import datetime
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, SeedInventory
from growpodempire.economy.ledger import balance, InsufficientFundsError
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.seasonal_service import SeasonalService, _next_month


def _this_month() -> str:
    return datetime.utcnow().strftime("%Y-%m")


def _strain_id(s, slug="blue-dream") -> str:
    return s.query(Strain).filter(Strain.slug == slug).one().id


def test_next_month_wraps_year():
    assert _next_month("2025-11") == "2025-12"
    assert _next_month("2025-12") == "2026-01"


def test_upsert_creates_then_updates(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        sid = _strain_id(s)
        created = svc.upsert(sid, _this_month(), Decimal("120"), auto_renew=True)
        assert created["price_gc"] == 120.0 and created["auto_renew"] is True
        assert created["is_current"] is True
        # Same strain+month → update in place (no second row).
        updated = svc.upsert(sid, _this_month(), Decimal("90"), auto_renew=False)
        assert updated["id"] == created["id"]
        assert updated["price_gc"] == 90.0 and updated["auto_renew"] is False
        assert len(svc.all_seasonal_strains()) == 1


def test_upsert_unknown_strain_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            SeasonalService(s).upsert("no-such-strain", _this_month(), Decimal("50"))


def test_current_month_listing(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        sid = _strain_id(s)
        svc.upsert(sid, _this_month(), Decimal("100"))
        svc.upsert(sid, "2020-01", Decimal("100"))  # an expired drop
        current = svc.current_month_strains()
        assert len(current) == 1 and current[0]["available_month"] == _this_month()
        assert len(svc.all_seasonal_strains()) == 2


def test_purchase_debits_and_grants_seed(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        p = GameService(s).create_player("seasonal_buyer")
        sid = _strain_id(s)
        row = svc.upsert(sid, _this_month(), Decimal("100"))
        before = balance(s, p.id)

        result = svc.purchase(p.id, row["id"])
        assert result["price_gc"] == 100.0
        assert balance(s, p.id) == before - Decimal("100.000000")
        stack = (
            s.query(SeedInventory)
            .filter(SeedInventory.player_id == p.id, SeedInventory.source == "seasonal")
            .one()
        )
        assert stack.quantity == 1
        # A second purchase stacks rather than creating a new row.
        svc.purchase(p.id, row["id"])
        assert stack.quantity == 2


def test_purchase_not_found_and_expired(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        p = GameService(s).create_player("edge")
        with pytest.raises(GameError):
            svc.purchase(p.id, "missing-id")
        expired = svc.upsert(_strain_id(s), "2020-01", Decimal("50"))
        with pytest.raises(GameError):
            svc.purchase(p.id, expired["id"])


def test_purchase_insufficient_funds(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        p = GameService(s).create_player("broke_seasonal")
        row = svc.upsert(_strain_id(s), _this_month(), Decimal("100000"))
        with pytest.raises(InsufficientFundsError):
            svc.purchase(p.id, row["id"])


def test_delete(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        row = svc.upsert(_strain_id(s), _this_month(), Decimal("100"))
        svc.delete(row["id"])
        assert svc.all_seasonal_strains() == []
        with pytest.raises(GameError):
            svc.delete(row["id"])


def test_rollover_renewals_carries_forward(db):
    with session_scope() as s:
        svc = SeasonalService(s)
        sid = _strain_id(s)
        svc.upsert(sid, _this_month(), Decimal("100"), auto_renew=True)
        svc.upsert(_strain_id(s, "white-widow"), _this_month(), Decimal("80"), auto_renew=False)

        created = svc.rollover_renewals()
        assert len(created) == 1  # only the auto_renew strain rolls forward
        assert created[0]["available_month"] == _next_month(_this_month())
        # Idempotent: running again creates nothing (already present).
        assert svc.rollover_renewals() == []


# ----- HTTP routes -------------------------------------------------------

@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def test_routes_public_list_and_purchase(client):
    with session_scope() as s:
        sid = _strain_id(s)
    # require_admin (dev/test) accepts any valid player key via X-API-Key.
    player = client.post("/api/game/players", json={"username": "http_seasonal"}).get_json()
    admin = {"X-API-Key": player["api_key"]}

    up = client.post(
        "/api/game/admin/seasonal/strains",
        json={"strain_id": sid, "available_month": _this_month(), "price_gc": 100},
        headers=admin,
    )
    assert up.status_code == 201
    seasonal_id = up.get_json()["id"]

    listing = client.get("/api/game/seasonal/strains")
    assert listing.status_code == 200 and len(listing.get_json()) == 1

    buy = client.post(
        f"/api/game/players/{player['id']}/seasonal/strains/{seasonal_id}/purchase",
        headers=admin,
    )
    assert buy.status_code == 201 and buy.get_json()["price_gc"] == 100.0

    # Admin rollover + list routes.
    assert client.get("/api/game/admin/seasonal/strains", headers=admin).status_code == 200
    assert client.post(
        "/api/game/admin/seasonal/strains/rollover", headers=admin
    ).status_code == 200
