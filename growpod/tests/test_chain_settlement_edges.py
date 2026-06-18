"""
Edge-branch coverage for the chain settlement / minting layer.

Targets specific UNCOVERED branches that the existing suites
(`test_settlement.py`, `test_minting.py`, `test_chain.py`,
`test_http_boundary.py`) leave out — deliberately NOT re-testing their happy
paths. Each test names the source line(s) it exercises:

  services/settlement_service.py: 51, 62, 76-77, 86, 103-104, 126-127
  api/chain_api.py:               40, 55-56, 87, 100-101
  chain/mock.py:                  28-31, 63, 71
  services/minting_service.py:    82, 86, 95, 122-124, 135, 138-141

All chain work runs on the offline MockChainProvider (no keys, no network):
either constructed directly or selected by the factory because the test env
has no treasury mnemonic configured.
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.config import get_settings
from growpodempire.chain.factory import reset_shared_provider
from growpodempire.chain.mock import MockChainProvider
from growpodempire.chain.provider import ChainError, ChainProvider, AssetMint, TREASURY
from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.enums import NFTStatus, Rarity, LineageType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.settlement_service import SettlementService
from growpodempire.services.minting_service import MintingService
from growpodempire.genetics.traits import genome_from_traits
from growpodempire.economy.ledger import post
from growpodempire.enums import LedgerEntryType


# --------------------------------------------------------------------------- #
# Test doubles                                                                 #
# --------------------------------------------------------------------------- #

class _BoomProvider(MockChainProvider):
    """A mock chain whose transfers always fail — to drive ChainError branches."""

    def transfer_asset(self, asset_id, receiver, amount, sender_mnemonic=None):
        raise ChainError("boom")


class _BoomMintProvider(MockChainProvider):
    """A mock chain whose asset creation always fails (for _mint failure path)."""

    def create_asset(self, **kwargs):
        raise ChainError("mint boom")

    def create_asset_tx(self, **kwargs):
        raise ChainError("mint boom")


def _svc(s, provider=None):
    # Let the service create its GROW token ASA on the given provider so the
    # mock's balance book knows the asset (matches test_settlement.py).
    return SettlementService(s, provider=provider or MockChainProvider())


# --------------------------------------------------------------------------- #
# settlement_service.py                                                        #
# --------------------------------------------------------------------------- #

def test_deposit_rejects_nonpositive_amount(db):
    """settlement_service.py:51 — _require_amount raises on amount <= 0.

    The existing suite only hits this via *withdraw*; deposit shares the same
    guard, so drive it from deposit to keep the case distinct.
    """
    with session_scope() as s:
        p = GameService(s).create_player("depzero")
        with pytest.raises(GameError):
            _svc(s).deposit(p.id, 0)


def test_withdraw_player_not_found(db):
    """settlement_service.py:86 — withdraw on a missing player id raises."""
    with session_scope() as s:
        with pytest.raises(GameError, match="Player not found"):
            _svc(s).withdraw("no-such-player", 10)


def test_withdraw_disabled_daily_cap_allows_large(db, monkeypatch):
    """settlement_service.py:62 — cap <= 0 short-circuits (cap disabled).

    With MAX_WITHDRAWAL_PER_DAY=0 the cap is off, so a withdrawal that would
    otherwise blow the default 10000/24h cap goes through.
    """
    monkeypatch.setenv("MAX_WITHDRAWAL_PER_DAY", "0")
    get_settings.cache_clear()
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("capoff")
        gs.link_wallet(p.id, "ADDRCAPOFF")
        # Fund well past the default cap so only the disabled-cap branch matters.
        post(s, p.id, Decimal("20000"), LedgerEntryType.STARTING_GRANT,
             ref_type="test", ref_id="topup")
        out = _svc(s).withdraw(p.id, 15000)
        assert out["withdrawn"] == 15000.0


def test_withdraw_exceeding_daily_cap_rejected(db, monkeypatch):
    """settlement_service.py:76-77 — rolling-24h cap blocks the second withdraw."""
    monkeypatch.setenv("MAX_WITHDRAWAL_PER_DAY", "150")
    get_settings.cache_clear()
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("capped")
        gs.link_wallet(p.id, "ADDRCAP")
        svc = _svc(s)
        svc.withdraw(p.id, 100)  # within cap
        s.flush()  # make the first entry visible to the cap query
        with pytest.raises(GameError, match="Daily withdrawal limit"):
            svc.withdraw(p.id, 100)  # 100 + 100 > 150 -> blocked


def test_withdraw_chain_failure_maps_to_game_error(db):
    """settlement_service.py:103-104 — ChainError on transfer -> GameError."""
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("wderr")
        gs.link_wallet(p.id, "ADDRERR")
        with pytest.raises(GameError, match="On-chain transfer failed"):
            _svc(s, provider=_BoomProvider()).withdraw(p.id, 10)


def test_deposit_chain_failure_maps_to_game_error(db):
    """settlement_service.py:126-127 — ChainError on deposit transfer -> GameError."""
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("dperr")
        gs.link_wallet(p.id, "ADDRDPERR")
        # Seed off-game ASA so the deposit reaches the transfer call.
        _svc(s).withdraw(p.id, 50)
        with pytest.raises(GameError, match="On-chain transfer failed"):
            _svc(s, provider=_BoomProvider()).deposit(p.id, 20)


# --------------------------------------------------------------------------- #
# chain/mock.py                                                                #
# --------------------------------------------------------------------------- #

def test_mock_create_account():
    """chain/mock.py:28-31 — create_account yields a MOCK address + mnemonic."""
    p = MockChainProvider()
    addr, mnemonic = p.create_account()
    assert addr.startswith("MOCK") and len(addr) == 60
    assert mnemonic.startswith("mock-mnemonic-")
    # Ids increment.
    addr2, _ = p.create_account()
    assert addr2 != addr


def test_mock_destroy_missing_asset_raises():
    """chain/mock.py:63 — destroying a non-existent asset raises ChainError."""
    p = MockChainProvider()
    with pytest.raises(ChainError, match="does not exist"):
        p.destroy_asset(999999)


def test_mock_transfer_missing_asset_raises():
    """chain/mock.py:71 — transferring a non-existent asset raises ChainError."""
    p = MockChainProvider()
    with pytest.raises(ChainError, match="does not exist"):
        p.transfer_asset(999999, "MOCKRECV", 5)


# --------------------------------------------------------------------------- #
# minting_service.py                                                           #
# --------------------------------------------------------------------------- #

def _stable_strain(s, player_id, rarity, stability=0.95, slug="edge-line"):
    strain = Strain(
        name="Edge Line",
        slug=slug,
        lineage_type=LineageType.BRED.value,
        rarity=rarity,
        indica_ratio=0.5, thc_min=20, thc_max=21, cbd_min=0.3, cbd_max=0.5,
        flowering_days_min=60, flowering_days_max=62, yield_min=400, yield_max=420,
        difficulty=3, terpenes=["limonene"],
        genome=genome_from_traits({"thc": 21, "yield": 400}),
        stability=stability, generation=4, is_base_catalog=False,
        created_by_player_id=player_id,
    )
    s.add(strain)
    s.flush()
    return strain


def test_mint_strain_not_found(db):
    """minting_service.py:82 — minting an unknown strain id raises."""
    with session_scope() as s:
        p = GameService(s).create_player("nostrain")
        with pytest.raises(GameError, match="Strain not found"):
            MintingService(s, provider=MockChainProvider()).mint_strain(p.id, "ghost")


def test_mint_strain_already_minted_is_idempotent(db):
    """minting_service.py:86 — an already-MINTED strain returns unchanged."""
    with session_scope() as s:
        p = GameService(s).create_player("dupemint")
        strain = _stable_strain(s, p.id, Rarity.EPIC.value, slug="already-minted")
        strain.nft_status = NFTStatus.MINTED.value
        strain.nft_asset_id = 4242
        s.flush()
        provider = MockChainProvider()
        out = MintingService(s, provider=provider).mint_strain(p.id, strain.id)
        assert out.nft_asset_id == 4242
        assert provider.assets == {}  # no new mint happened


def test_mint_strain_stable_but_low_rarity_rejected(db):
    """minting_service.py:95 — stability OK but rarity below 'rare' threshold."""
    with session_scope() as s:
        p = GameService(s).create_player("lowrarity")
        # High stability clears L89, but COMMON rarity is below the 'rare' floor.
        strain = _stable_strain(s, p.id, Rarity.COMMON.value, slug="low-rarity-line")
        with pytest.raises(GameError, match="below the mint threshold"):
            MintingService(s, provider=MockChainProvider()).mint_strain(p.id, strain.id)


def test_mint_chain_failure_marks_failed(db):
    """minting_service.py:122-124 — ChainError in _mint -> status FAILED + raise."""
    with session_scope() as s:
        p = GameService(s).create_player("mintfail")
        strain = _stable_strain(s, p.id, Rarity.EPIC.value, slug="mint-fail-line")
        with pytest.raises(GameError, match="On-chain mint failed"):
            MintingService(s, provider=_BoomMintProvider()).mint_strain(p.id, strain.id)
        s.flush()
        assert s.get(Strain, strain.id).nft_status == NFTStatus.FAILED.value


def test_metadata_for_harvest_not_found(db):
    """minting_service.py:135 — metadata_for('harvest', missing) raises."""
    with session_scope() as s:
        with pytest.raises(GameError, match="Harvest not found"):
            MintingService(s, provider=MockChainProvider()).metadata_for("harvest", "ghost")


def test_metadata_for_strain_not_found(db):
    """minting_service.py:138-139 — metadata_for('strain', missing) raises."""
    with session_scope() as s:
        with pytest.raises(GameError, match="Strain not found"):
            MintingService(s, provider=MockChainProvider()).metadata_for("strain", "ghost")


def test_metadata_for_unknown_kind(db):
    """minting_service.py:142 — metadata_for with an unknown kind raises."""
    with session_scope() as s:
        with pytest.raises(GameError, match="Unknown metadata kind"):
            MintingService(s, provider=MockChainProvider()).metadata_for("bogus", "x")


# --------------------------------------------------------------------------- #
# api/chain_api.py  (internal admin mint endpoints)                           #
# --------------------------------------------------------------------------- #

@pytest.fixture()
def client(db, monkeypatch):
    """Flask test client on a fresh offline-mock chain (no treasury keys)."""
    from growpodempire.api.flask_api import create_app

    monkeypatch.delenv("ALGO_TREASURY_MNEMONIC", raising=False)
    monkeypatch.delenv("ASA_ID", raising=False)
    monkeypatch.delenv("ADMIN_SECRET", raising=False)  # dev path: any player key
    get_settings.cache_clear()
    reset_shared_provider()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        reset_shared_provider()
        get_settings.cache_clear()


def _admin_key(client):
    """A valid player api_key — accepted by require_admin in the dev/test env."""
    p = client.post("/api/game/players", json={"username": "chainadmin"}).get_json()
    return {"X-API-Key": p["api_key"]}


def test_mint_seed_requires_owner_address(client):
    """chain_api.py:40 — mint-seed rejects a body missing ownerAddress."""
    r = client.post(
        "/api/chain/mint-seed", json={"traits": {"thc": 20}}, headers=_admin_key(client)
    )
    assert r.status_code == 400
    assert "ownerAddress" in r.get_json()["error"]


def test_mint_harvest_requires_owner_address(client):
    """chain_api.py:87 — mint-harvest with growId set but ownerAddress missing."""
    r = client.post(
        "/api/chain/mint-harvest", json={"growId": "g1"}, headers=_admin_key(client)
    )
    assert r.status_code == 400
    assert "ownerAddress" in r.get_json()["error"]


def test_mint_seed_chain_failure_returns_502(client, monkeypatch):
    """chain_api.py:55-56 — a ChainError during mint maps to HTTP 502."""
    from growpodempire.api import chain_api

    # chain_api binds shared_provider by name at import, so patch it there.
    monkeypatch.setattr(chain_api, "shared_provider", lambda *a, **k: _BoomMintProvider())
    r = client.post(
        "/api/chain/mint-seed",
        json={"ownerAddress": "ALGOOWNER", "traits": {"thc": 20}},
        headers=_admin_key(client),
    )
    assert r.status_code == 502
    assert "On-chain mint failed" in r.get_json()["error"]


def test_mint_harvest_chain_failure_returns_502(client, monkeypatch):
    """chain_api.py:100-101 — a ChainError during harvest mint maps to HTTP 502."""
    from growpodempire.api import chain_api

    monkeypatch.setattr(chain_api, "shared_provider", lambda *a, **k: _BoomMintProvider())
    r = client.post(
        "/api/chain/mint-harvest",
        json={"growId": "g1", "ownerAddress": "ALGOOWNER"},
        headers=_admin_key(client),
    )
    assert r.status_code == 502
    assert "On-chain mint failed" in r.get_json()["error"]
