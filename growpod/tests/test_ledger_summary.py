"""Economy dashboard: trailing daily ledger aggregates (faucet/sink supply chart).

Covers economy_service.ledger_daily_summary (the dense day-indexed minted/burned/
seasonal-sink series + projector-seeding aggregates) and the admin HTTP route. This
is the economy-observability surface that backs the launch money-supply dashboard.
"""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import post
from growpodempire.enums import LedgerEntryType as L
from growpodempire.services import economy_service
from growpodempire.services.game_service import GameService


def _player_with_activity(s):
    p = GameService(s).create_player("ledger_dash")  # STARTING_GRANT faucet
    post(s, p.id, Decimal("50"), L.DAILY_STIPEND)          # faucet
    post(s, p.id, Decimal("200"), L.HARVEST_SALE)          # faucet
    post(s, p.id, -Decimal("25"), L.SEED_PURCHASE)         # sink (regular seed)
    post(
        s, p.id, -Decimal("40"), L.SEED_PURCHASE,
        ref_type="seasonal_strain", ref_id="x",
    )                                                       # seasonal sink
    post(s, p.id, -Decimal("30"), L.TUITION)               # sink
    return p


def test_ledger_daily_summary_structure_and_totals(db):
    with session_scope() as s:
        _player_with_activity(s)
    with session_scope() as s:
        summary = economy_service.ledger_daily_summary(s, days=30)

    assert summary["days"] == 30
    # Dense series: one entry per calendar day in the window.
    assert len(summary["daily"]) == 30
    for row in summary["daily"]:
        assert {"date", "minted", "burned", "seasonal_sink", "supply_delta"} <= set(row)

    totals = summary["totals"]
    assert totals["minted"] > 0 and totals["burned"] > 0
    # Today's row carries the activity we posted.
    today = summary["daily"][-1]
    assert today["minted"] > 0          # starting grant + stipend + harvest
    assert today["burned"] > 0          # seed + seasonal + tuition
    assert today["seasonal_sink"] == 40.0


def test_ledger_daily_summary_empty_window(db):
    """No ledger activity → a full dense series of zeros, no crash."""
    with session_scope() as s:
        summary = economy_service.ledger_daily_summary(s, days=7)
    assert len(summary["daily"]) == 7
    assert all(r["minted"] == 0 and r["burned"] == 0 for r in summary["daily"])


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def test_admin_route_returns_summary(client):
    with session_scope() as s:
        _player_with_activity(s)
    # require_admin (dev/test) accepts any valid player key via X-API-Key.
    key = client.post("/api/game/players", json={"username": "admin_dash"}).get_json()["api_key"]
    hdr = {"X-API-Key": key}
    resp = client.get("/api/game/admin/economy/ledger-summary?days=30", headers=hdr)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["days"] == 30 and len(body["daily"]) == 30

    # days is clamped to [7, 90].
    clamped = client.get(
        "/api/game/admin/economy/ledger-summary?days=999", headers=hdr
    ).get_json()
    assert clamped["days"] == 90
