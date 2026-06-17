"""
HTTP-boundary coverage for the value-bearing game_api routes (STEP 4 / BE-A09;
addresses carried RISK #8: "game_api.py is thinly covered at the HTTP layer").

These drive the Flask routes directly — request parsing, auth, status codes, and
error mapping — for wallet withdraw/deposit and NFT minting, paths previously
covered only at the service layer (`test_settlement.py`, `test_minting.py`).

The offline `MockChainProvider` backs every chain call (no network, no secrets);
it is selected automatically because no treasury mnemonic is configured in the
test environment. The provider singleton is reset per test so ASA/NFT ids don't
leak between cases.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.chain.factory import reset_shared_provider
from growpodempire.config import get_settings


@pytest.fixture()
def client(db, monkeypatch):
    """Plain Flask test client (no dev clock) on a fresh offline-mock chain."""
    from growpodempire.api.flask_api import create_app

    # Force the offline mock chain: clear any treasury config and reset the
    # shared provider singleton so the factory hands back a MockChainProvider.
    monkeypatch.delenv("ALGO_TREASURY_MNEMONIC", raising=False)
    monkeypatch.delenv("ASA_ID", raising=False)
    get_settings.cache_clear()
    reset_shared_provider()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        reset_shared_provider()
        get_settings.cache_clear()


def _new_player(client, username="boundary"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _link(client, pid, key, address="ALGOADDR1"):
    client.post(
        f"/api/game/players/{pid}/wallet/link",
        json={"address": address},
        headers={"X-API-Key": key},
    )


def _wallet(client, pid, key):
    return client.get(
        f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
    ).get_json()


# --- wallet withdraw ---------------------------------------------------------

def test_withdraw_happy_path(client):
    pid, key = _new_player(client, "withdrawer")
    hdr = {"X-API-Key": key}
    _link(client, pid, key)

    r = client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={"amount": 100}, headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["txid"].startswith("MOCKTX")
    assert body["withdrawn"] == 100.0
    assert body["asa_balance"] == 100.0

    # In-game balance dropped by 100 (started at the 500 GROW signup grant);
    # the ASA mirror rose by 100.
    w = _wallet(client, pid, key)
    assert w["balance"] == 400.0
    assert w["asa_balance"] == 100.0


def test_withdraw_requires_amount(client):
    pid, key = _new_player(client, "noamount")
    _link(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={}, headers={"X-API-Key": key}
    )
    assert r.status_code == 400


def test_withdraw_rejects_nonpositive_amount(client):
    pid, key = _new_player(client, "negamt")
    hdr = {"X-API-Key": key}
    _link(client, pid, key)
    assert client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={"amount": 0}, headers=hdr
    ).status_code == 400
    assert client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={"amount": -5}, headers=hdr
    ).status_code == 400


def test_withdraw_requires_linked_wallet(client):
    pid, key = _new_player(client, "unlinked")
    r = client.post(
        f"/api/game/players/{pid}/wallet/withdraw",
        json={"amount": 10},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_withdraw_insufficient_funds(client):
    pid, key = _new_player(client, "broke")
    hdr = {"X-API-Key": key}
    _link(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={"amount": 999999}, headers=hdr
    )
    assert r.status_code == 400


def test_withdraw_requires_auth(client):
    pid, _ = _new_player(client, "noauth")
    # No X-API-Key header -> rejected before any chain work.
    r = client.post(f"/api/game/players/{pid}/wallet/withdraw", json={"amount": 10})
    assert r.status_code in (401, 403)


# --- wallet deposit ----------------------------------------------------------

def test_deposit_roundtrips_with_withdraw(client):
    pid, key = _new_player(client, "depositor")
    hdr = {"X-API-Key": key}
    _link(client, pid, key)
    client.post(
        f"/api/game/players/{pid}/wallet/withdraw", json={"amount": 200}, headers=hdr
    )

    r = client.post(
        f"/api/game/players/{pid}/wallet/deposit", json={"amount": 120}, headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["txid"].startswith("MOCKTX")
    assert body["deposited"] == 120.0

    # 500 - 200 + 120 = 420 in-game; 200 - 120 = 80 ASA still off-game.
    w = _wallet(client, pid, key)
    assert w["balance"] == 420.0
    assert w["asa_balance"] == 80.0


def test_deposit_requires_amount(client):
    pid, key = _new_player(client, "depnoamt")
    r = client.post(
        f"/api/game/players/{pid}/wallet/deposit", json={}, headers={"X-API-Key": key}
    )
    assert r.status_code == 400


def test_deposit_more_than_asa_balance_rejected(client):
    pid, key = _new_player(client, "noasa")
    hdr = {"X-API-Key": key}
    _link(client, pid, key)
    # Nothing withdrawn yet -> no off-game ASA to deposit back.
    r = client.post(
        f"/api/game/players/{pid}/wallet/deposit", json={"amount": 50}, headers=hdr
    )
    assert r.status_code == 400


# --- NFT minting -------------------------------------------------------------

def _rare_harvest(client, pid, key):
    """Harvest a rare strain immediately (harvest has no stage gate) so we have a
    mint-eligible (rarity >= 'rare') harvest without a full grow."""
    hdr = {"X-API-Key": key}
    strains = client.get("/api/game/strains").get_json()
    sid = next(s for s in strains if s["rarity"] == "rare")["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "T", "capacity": 2}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return client.post(
        f"/api/game/players/{pid}/plants/{plant['id']}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()


def test_mint_harvest_happy_path_is_idempotent(client):
    pid, key = _new_player(client, "minter")
    hdr = {"X-API-Key": key}
    h = _rare_harvest(client, pid, key)
    assert h["rarity"] == "rare"

    r = client.post(
        f"/api/game/players/{pid}/harvests/{h['id']}/mint", headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["nft_status"] == "minted"
    assert body["nft_asset_id"] is not None

    # Minting again returns the same minted asset (idempotent, no double-mint).
    r2 = client.post(
        f"/api/game/players/{pid}/harvests/{h['id']}/mint", headers=hdr
    )
    assert r2.status_code == 201
    assert r2.get_json()["nft_asset_id"] == body["nft_asset_id"]


def test_mint_harvest_not_found(client):
    pid, key = _new_player(client, "ghostmint")
    r = client.post(
        f"/api/game/players/{pid}/harvests/does-not-exist/mint",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_mint_strain_rejects_non_breeder(client):
    pid, key = _new_player(client, "notbreeder")
    sid = client.get("/api/game/strains").get_json()[0]["id"]
    # Seeded catalog strains have no breeder -> only the breeder may mint -> 400.
    r = client.post(
        f"/api/game/players/{pid}/strains/{sid}/mint", headers={"X-API-Key": key}
    )
    assert r.status_code == 400


def test_nft_metadata_served_after_mint(client):
    pid, key = _new_player(client, "metaminter")
    hdr = {"X-API-Key": key}
    h = _rare_harvest(client, pid, key)
    client.post(f"/api/game/players/{pid}/harvests/{h['id']}/mint", headers=hdr)

    # Metadata JSON is public (ARC-3 URL target) — no auth needed.
    r = client.get(f"/api/game/nft/harvest/{h['id']}.json")
    assert r.status_code == 200
    meta = r.get_json()
    assert isinstance(meta, dict) and meta  # non-empty ARC-3 metadata

    # Unknown kind -> 404.
    assert client.get("/api/game/nft/bogus/x.json").status_code == 404
