"""Public economy transparency view — faucet/sink health over the ledger.

Asserts the aggregation is correct and reconciles with the money supply, and
that the public read-only route works without auth.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app
from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import post
from growpodempire.enums import LedgerEntryType
from growpodempire.services import economy_service
from growpodempire.services.game_service import GameService


def _seed_economy(s):
    """A player with a faucet (grant) and a sink (seed purchase)."""
    svc = GameService(s)
    player = svc.create_player("auditor")
    post(s, player_id=player.id, entry_type=LedgerEntryType.STARTING_GRANT.value,
         amount="1000")
    post(s, player_id=player.id, entry_type=LedgerEntryType.SEED_PURCHASE.value,
         amount="-150")
    return player


def test_classify_covers_the_taxonomy():
    assert economy_service._classify("starting_grant") == "faucet"
    assert economy_service._classify("seed_purchase") == "sink"
    assert economy_service._classify("market_sale") == "transfer"
    assert economy_service._classify("asa_deposit") == "chain"
    assert economy_service._classify("adjustment") == "other"


def test_health_aggregates_and_reconciles(db):
    # Measure deltas so the test is robust to the create_player starting grant.
    with session_scope() as s:
        svc = GameService(s)
        player = svc.create_player("auditor")
        pid = player.id
    with session_scope() as s:
        before = economy_service.economy_health(s)

    with session_scope() as s:
        post(s, player_id=pid, entry_type=LedgerEntryType.STARTING_GRANT.value,
             amount="1000")
        post(s, player_id=pid, entry_type=LedgerEntryType.SEED_PURCHASE.value,
             amount="-150")
    with session_scope() as s:
        after = economy_service.economy_health(s)

    # Faucet/sink are reported as magnitudes; assert the applied deltas.
    assert after["faucet_total"] - before["faucet_total"] == pytest.approx(1000.0)
    assert after["sink_total"] - before["sink_total"] == pytest.approx(150.0)
    assert after["net_issuance"] - before["net_issuance"] == pytest.approx(850.0)
    assert after["inflating"] is True
    # Ledger net == money supply (double-entry self-consistency).
    assert after["reconciled"] is True
    assert after["money_supply"] == pytest.approx(after["ledger_net"])


def test_health_breakdown_lists_each_type(db):
    with session_scope() as s:
        _seed_economy(s)
    with session_scope() as s:
        report = economy_service.economy_health(s)
    types = {row["entry_type"] for row in report["by_type"]}
    assert "starting_grant" in types and "seed_purchase" in types


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_health_route_is_public(client):
    with session_scope() as s:
        _seed_economy(s)
    resp = client.get("/api/game/economy/health")
    assert resp.status_code == 200
    body = resp.get_json()
    assert "money_supply" in body and "by_type" in body
