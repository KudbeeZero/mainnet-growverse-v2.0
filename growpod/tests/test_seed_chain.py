"""Clone Room seed minting over the chain provider + /api/chain/mint-seed."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.api.flask_api import create_app
from growpodempire.chain.mock import MockChainProvider
from growpodempire.chain import metadata as md
from growpodempire.db.session import session_scope
from growpodempire.services.game_service import GameService


SEED = {
    "seedId": "11111111-2222-3333-4444-555555555555",
    "ownerAddress": "FRONTIERPLAYERADDRESS7XYZ",
    "blockHash": "ABCDEF0123456789BLOCKHASH",
    "nonce": "99999999-8888-7777-6666-555555555555",
    "generationNum": 0,
    "parentSeedId": None,
    "traits": {
        "strainFamily": "indica",
        "growthRate": 1.0,
        "internodeSpacing": 0.5,
        "leafDensity": 0.5,
        "resinProfile": 0.5,
        "colorShift": 180.0,
        "mutationFlag": False,
        "parentSeedId": None,
    },
}


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


@pytest.fixture()
def admin_key(db):
    """A valid player api key — accepted by require_admin in non-prod dev mode."""
    with session_scope() as s:
        player = GameService(s).create_player("seed-minter")
        return player.api_key


# ----- provider: create_asset_tx returns id + txid ------------------------
def test_create_asset_tx_returns_id_and_txid():
    p = MockChainProvider()
    mint = p.create_asset_tx(unit_name="GPSEED", asset_name="indica Seed", total=1, decimals=0)
    assert mint.asset_id in p.assets
    assert mint.txid is not None


def test_default_create_asset_tx_has_no_txid():
    # The ABC default (used by providers that don't override) reports no txid.
    from growpodempire.chain.provider import ChainProvider

    class Minimal(MockChainProvider):
        # Fall back to the base implementation rather than the mock override.
        create_asset_tx = ChainProvider.create_asset_tx

    mint = Minimal().create_asset_tx(unit_name="X", asset_name="X", total=1, decimals=0)
    assert mint.asset_id is not None
    assert mint.txid is None


# ----- metadata: entropy inputs are anchored ------------------------------
def test_seed_metadata_anchors_entropy_and_traits():
    meta = md.seed_metadata(SEED)
    props = meta["properties"]
    assert props["type"] == "seed"
    assert props["block_hash"] == SEED["blockHash"]
    assert props["nonce"] == SEED["nonce"]
    assert props["traits"] == SEED["traits"]
    # Hash is deterministic for identical metadata and 32 bytes (ASA field).
    assert md.metadata_hash(meta) == md.metadata_hash(md.seed_metadata(SEED))
    assert len(md.metadata_hash(meta)) == 32


# ----- endpoint -----------------------------------------------------------
def test_mint_seed_endpoint_returns_asset(client, admin_key):
    resp = client.post("/api/chain/mint-seed", json=SEED, headers={"X-API-Key": admin_key})
    assert resp.status_code == 201
    body = resp.get_json()
    assert isinstance(body["assetId"], int)
    assert body["txId"] is not None
    assert body["network"] == "mock"


def test_mint_seed_requires_admin(client):
    resp = client.post("/api/chain/mint-seed", json=SEED)
    assert resp.status_code == 401


def test_mint_seed_validates_body(client, admin_key):
    resp = client.post("/api/chain/mint-seed", json={"ownerAddress": "X"}, headers={"X-API-Key": admin_key})
    assert resp.status_code == 400
