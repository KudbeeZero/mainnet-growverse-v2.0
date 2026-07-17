"""
HTTP-boundary coverage for the timed-NPC-contract routes in ``api/game_api.py``
(backed by ``services/contract_service.py``). The service layer is already
exercised by ``test_contracts.py``; this file drives the Flask routes — request
parsing, API-key auth, the ``contracts`` feature gate, status codes and error
mapping — which were previously untested at the HTTP layer.

Routes covered:
  - GET  /api/game/players/<id>/contracts                       (list)
  - POST /api/game/players/<id>/contracts/offer                 (draw a contract)
  - POST /api/game/players/<id>/contracts/<contract_id>/fulfill (deliver goods)

The HTTP ``offer`` route draws a template with a *server-generated* RNG seed
(no client seed-shopping), so the drawn rarity is not controllable over HTTP.
For the fulfill happy path we therefore seed a known (common) contract and stock
matching unsold harvests through the service directly, then drive ``fulfill``
over HTTP — the documented "use the service for setup, then drive HTTP" pattern.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Contract, Harvest
from growpodempire.services.game_service import GameService
from growpodempire.services.contract_service import ContractService


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="contractor"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _stock_common_harvests(player_id, grams=60, n=2):
    """Stock the player with ``n`` unsold common harvests via the service layer
    so a common contract (target 100g) is fulfillable; returns nothing — the
    caller drives the actual fulfill over HTTP."""
    with session_scope() as s:
        svc = GameService(s)
        strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        rarity = getattr(strain.rarity, "value", strain.rarity)
        assert rarity == "common"  # common template targets this rarity
        for _ in range(n):
            stack = svc.buy_seed(player_id, strain.id)
            pod = svc.create_pod(player_id, "Tent", charge=False)
            plant = svc.plant_seed(player_id, stack.id, pod.id)
            svc.harvest_plant(player_id, plant.id, weight_g=grams, quality=80, sell=False)


def _seed_common_contract(player_id):
    """Create an *open, common-rarity* contract directly through the service so
    the HTTP fulfill path has a known, fulfillable target. Returns its id."""
    with session_scope() as s:
        cs = ContractService(s)
        contract = cs.offer(player_id, rng_seed=1)
        # Re-roll the server RNG until we land on a common template (target 100g)
        # so the harvests stocked above are sufficient.
        tries = 0
        while contract.target_rarity != "common":
            tries += 1
            contract = cs.offer(player_id, rng_seed=tries)
        return contract.id


# --- GET /contracts (list) ---------------------------------------------------

def test_list_contracts_empty(client):
    pid, key = _new_player(client, "lister_empty")
    r = client.get(
        f"/api/game/players/{pid}/contracts", headers={"X-API-Key": key}
    )
    assert r.status_code == 200
    assert r.get_json() == []


def test_list_contracts_after_offer(client):
    pid, key = _new_player(client, "lister")
    hdr = {"X-API-Key": key}
    offered = client.post(
        f"/api/game/players/{pid}/contracts/offer", headers=hdr
    ).get_json()

    r = client.get(f"/api/game/players/{pid}/contracts", headers=hdr)
    assert r.status_code == 200
    body = r.get_json()
    assert len(body) == 1
    assert body[0]["id"] == offered["id"]
    assert body[0]["status"] == "open"


def test_list_contracts_status_filter(client):
    pid, key = _new_player(client, "lister_filter")
    hdr = {"X-API-Key": key}
    client.post(f"/api/game/players/{pid}/contracts/offer", headers=hdr)

    # The lone contract is open, so a status=fulfilled filter yields nothing.
    open_only = client.get(
        f"/api/game/players/{pid}/contracts?status=open", headers=hdr
    )
    assert open_only.status_code == 200 and len(open_only.get_json()) == 1
    none = client.get(
        f"/api/game/players/{pid}/contracts?status=fulfilled", headers=hdr
    )
    assert none.status_code == 200 and none.get_json() == []


def test_list_contracts_requires_auth(client):
    pid, _ = _new_player(client, "lister_noauth")
    r = client.get(f"/api/game/players/{pid}/contracts")
    assert r.status_code == 401


# --- POST /contracts/offer ---------------------------------------------------

def test_offer_creates_open_contract(client):
    pid, key = _new_player(client, "offerer")
    r = client.post(
        f"/api/game/players/{pid}/contracts/offer", headers={"X-API-Key": key}
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["status"] == "open"
    assert body["target_grams"] > 0
    assert body["reward_grow"] > 0
    assert body["target_rarity"] in ("common", "uncommon", "rare")


def test_offer_requires_auth(client):
    pid, _ = _new_player(client, "offer_noauth")
    r = client.post(f"/api/game/players/{pid}/contracts/offer")
    assert r.status_code == 401


def test_offer_unknown_player_rejected(client):
    # require_player resolves the path id before the view runs -> 404 for a
    # made-up player id (no valid key can exist for it).
    r = client.post(
        "/api/game/players/no-such-player/contracts/offer",
        headers={"X-API-Key": "whatever"},
    )
    assert r.status_code == 404


# --- POST /contracts/<id>/fulfill --------------------------------------------

def test_fulfill_happy_path(client):
    pid, key = _new_player(client, "fulfiller")
    hdr = {"X-API-Key": key}

    _stock_common_harvests(pid, grams=60, n=2)  # 120g >= 100g common target
    contract_id = _seed_common_contract(pid)

    # Capture the pre-fulfill balance AFTER stocking: seeds now cost GROW at
    # launch pricing, so the wallet is debited before the contract reward lands.
    wallet_before = client.get(
        f"/api/game/players/{pid}/wallet", headers=hdr
    ).get_json()["balance"]

    r = client.post(
        f"/api/game/players/{pid}/contracts/{contract_id}/fulfill", headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["contract_id"] == contract_id
    assert body["reward_grow"] > 0
    # Reward was paid into the in-game balance.
    assert body["balance"] == pytest.approx(wallet_before + body["reward_grow"])

    # Contract is now fulfilled and the unsold harvests were consumed.
    with session_scope() as s:
        assert s.get(Contract, contract_id).status == "fulfilled"
        unsold = (
            s.query(Harvest)
            .filter(Harvest.player_id == pid, Harvest.sold.is_(False))
            .count()
        )
        assert unsold == 0

    # A second fulfill of the same (now-closed) contract is rejected.
    again = client.post(
        f"/api/game/players/{pid}/contracts/{contract_id}/fulfill", headers=hdr
    )
    assert again.status_code == 400


def test_fulfill_without_goods_rejected(client):
    pid, key = _new_player(client, "emptyhanded")
    hdr = {"X-API-Key": key}
    # Offer over HTTP (any rarity); with zero matching harvests, fulfill fails.
    contract = client.post(
        f"/api/game/players/{pid}/contracts/offer", headers=hdr
    ).get_json()
    r = client.post(
        f"/api/game/players/{pid}/contracts/{contract['id']}/fulfill", headers=hdr
    )
    assert r.status_code == 400


def test_fulfill_unknown_contract_404(client):
    # The service raises GameError("Contract not found") -> _error default 400.
    pid, key = _new_player(client, "ghostfulfill")
    r = client.post(
        f"/api/game/players/{pid}/contracts/does-not-exist/fulfill",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "not found" in r.get_json()["error"].lower()


def test_fulfill_requires_auth(client):
    pid, _ = _new_player(client, "fulfill_noauth")
    r = client.post(
        f"/api/game/players/{pid}/contracts/some-contract/fulfill"
    )
    assert r.status_code == 401


# --- feature gate ------------------------------------------------------------

def test_contracts_gated_off_returns_404(client, monkeypatch):
    # With the contracts feature flag OFF, every gated route reads as 404
    # ("not available") rather than a hard error. The gate is the outermost
    # decorator, so it fires before auth.
    monkeypatch.setenv("FEATURE_CONTRACTS", "false")
    pid, key = _new_player(client, "gated")
    hdr = {"X-API-Key": key}
    assert client.get(
        f"/api/game/players/{pid}/contracts", headers=hdr
    ).status_code == 404
    assert client.post(
        f"/api/game/players/{pid}/contracts/offer", headers=hdr
    ).status_code == 404
    assert client.post(
        f"/api/game/players/{pid}/contracts/x/fulfill", headers=hdr
    ).status_code == 404
