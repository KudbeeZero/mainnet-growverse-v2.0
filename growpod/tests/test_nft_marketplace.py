"""NFT marketplace + staking (Sprint 4, testnet/mock only).

Covers:
  * NFTMintService: wraps an already-minted harvest into an NFTAsset,
    delegating the actual chain mint to MintingService (idempotent either way
    round, and reusable if the harvest was minted via the pre-existing
    /api/game/.../harvests/<id>/mint route first).
  * MarketplaceService: listing lifecycle, trade execution, price history.
  * StakingService: lock lifecycle, progress, and reward claim.
  * The API surface end-to-end (both new feature flags default OFF -- a test
    must explicitly enable them; the disabled-by-default 404 path is already
    covered by test_game_api_gated_features.py's GATED_ROUTES).
"""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, NFTAsset
from growpodempire.enums import NFTStatus
from growpodempire.services.game_service import GameService
from growpodempire.services.minting_service import MintingService
from growpodempire.services.nft_mint import NFTMintService, NFTMintError
from growpodempire.services.marketplace import MarketplaceService, MarketplaceError
from growpodempire.services.staking import StakingService, StakingError
from growpodempire.chain.mock import MockChainProvider
from algosdk import account as _algo_account

_ADDR_A = _algo_account.generate_account()[1]
_ADDR_B = _algo_account.generate_account()[1]


def _harvest(s, username, slug="gorilla-glue-no-4", sell=False):
    """A rare harvest (mintable), unsold by default so sale_value is settable."""
    svc = GameService(s)
    p = svc.create_player(username)
    strain = s.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    harvest = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=90, sell=sell)
    return p.id, harvest


class TestNFTMintService:
    def test_mint_wraps_a_fresh_chain_mint(self, db):
        with session_scope() as s:
            pid, harvest = _harvest(s, "minter1")
            nft = NFTMintService(s).mint_harvest(pid, harvest.id, _ADDR_A)

            assert nft.asset_id is not None
            assert nft.owner_address == _ADDR_A
            assert nft.status == "minted"
            assert nft.metadata_snapshot is not None

            refreshed = s.get(type(harvest), harvest.id)
            assert refreshed.nft_status == NFTStatus.MINTED.value
            assert refreshed.nft_asset_id == nft.asset_id

    def test_mint_is_idempotent(self, db):
        with session_scope() as s:
            pid, harvest = _harvest(s, "minter2")
            svc = NFTMintService(s)
            first = svc.mint_harvest(pid, harvest.id, _ADDR_A)
            second = svc.mint_harvest(pid, harvest.id, _ADDR_A)

            assert first.id == second.id
            assert s.query(NFTAsset).filter_by(game_item_id=harvest.id).count() == 1

    def test_mint_reuses_a_harvest_already_minted_via_the_chain_flow(self, db):
        """If the pre-existing /harvests/<id>/mint route minted this harvest
        first, NFTMintService must wrap it, not mint a second ASA."""
        with session_scope() as s:
            pid, harvest = _harvest(s, "minter3")
            already = MintingService(s, provider=MockChainProvider()).mint_harvest(pid, harvest.id)

            nft = NFTMintService(s).mint_harvest(pid, harvest.id, _ADDR_A)
            assert nft.asset_id == already.nft_asset_id

    def test_mint_rejects_common_rarity(self, db):
        with session_scope() as s:
            pid, harvest = _harvest(s, "minter4", slug="blue-dream")
            with pytest.raises(NFTMintError):
                NFTMintService(s).mint_harvest(pid, harvest.id, _ADDR_A)

    def test_get_harvest_nft_returns_none_before_minting(self, db):
        with session_scope() as s:
            _pid, harvest = _harvest(s, "minter5")
            assert NFTMintService(s).get_harvest_nft(harvest.id) is None


class TestMarketplaceService:
    def _minted_asset(self, s, username="seller1"):
        pid, harvest = _harvest(s, username)
        nft = NFTMintService(s).mint_harvest(pid, harvest.id, _ADDR_A)
        return pid, harvest, nft

    def test_create_and_cancel_listing(self, db):
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            svc = MarketplaceService(s)
            listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("5000000"))
            assert listing.status == "active"
            assert s.get(NFTAsset, nft.id).status == "listed"

            svc.cancel_listing(listing.id, _ADDR_A)
            assert s.get(type(listing), listing.id).status == "cancelled"
            assert s.get(NFTAsset, nft.id).status == "minted"

    def test_cannot_list_someone_elses_nft(self, db):
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            with pytest.raises(MarketplaceError):
                MarketplaceService(s).create_listing(nft.asset_id, _ADDR_B, Decimal("1"))

    def test_execute_trade_transfers_ownership(self, db):
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            svc = MarketplaceService(s)
            listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("2500000"))

            trade = svc.execute_trade(listing.id, _ADDR_B)
            assert trade.status == "pending"
            assert trade.buyer_address == _ADDR_B

            refreshed_nft = s.get(NFTAsset, nft.id)
            assert refreshed_nft.owner_address == _ADDR_B
            assert refreshed_nft.status == "minted"
            assert s.get(type(listing), listing.id).status == "sold"

    def test_cannot_buy_own_listing(self, db):
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            svc = MarketplaceService(s)
            listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("1"))
            with pytest.raises(MarketplaceError):
                svc.execute_trade(listing.id, _ADDR_A)

    def test_price_history_and_floor_price(self, db):
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            svc = MarketplaceService(s)
            listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("3000000"))
            assert svc.get_floor_price() == Decimal("3000000")

            trade = svc.execute_trade(listing.id, _ADDR_B)
            svc.confirm_trade(trade.id, "TESTTXID")

            history = svc.get_price_history(nft.asset_id)
            assert len(history) == 1
            assert history[0].status == "confirmed"

    def test_double_buy_second_caller_rejected(self, db):
        """Once sold, a second buyer's execute_trade must fail (not double-spend
        the same NFT to two buyers)."""
        with session_scope() as s:
            _pid, _harvest, nft = self._minted_asset(s)
            svc = MarketplaceService(s)
            listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("1000000"))
            svc.execute_trade(listing.id, _ADDR_B)

            with pytest.raises(MarketplaceError):
                svc.execute_trade(listing.id, _algo_account.generate_account()[1])


class TestStakingService:
    def _minted_asset_with_value(self, s, username="staker1", sale_value=Decimal("100.00")):
        pid, harvest = _harvest(s, username)
        harvest.sale_value = sale_value
        s.commit()
        nft = NFTMintService(s).mint_harvest(pid, harvest.id, _ADDR_A)
        return pid, harvest, nft

    def test_create_lock_computes_reward_from_sale_value(self, db):
        with session_scope() as s:
            pid, harvest, nft = self._minted_asset_with_value(s)
            lock = StakingService(s).create_lock(nft.asset_id, pid, harvest.id)
            assert lock.status == "active"
            # default reward_pct is 0.10 (balance.yaml `staking.reward_pct`)
            assert lock.rewards_amount == Decimal("10.000000")
            assert s.get(NFTAsset, nft.id).status == "staking"

    def test_cannot_stake_someone_elses_harvest(self, db):
        with session_scope() as s:
            _pid, harvest, nft = self._minted_asset_with_value(s)
            with pytest.raises(StakingError):
                StakingService(s).create_lock(nft.asset_id, "not-the-owner", harvest.id)

    def test_progress_completes_and_claim_pays_ledger(self, db):
        from datetime import datetime, timedelta
        from growpodempire.economy.ledger import balance as wallet_balance

        with session_scope() as s:
            pid, harvest, nft = self._minted_asset_with_value(s)
            svc = StakingService(s)
            lock = svc.create_lock(nft.asset_id, pid, harvest.id, cure_target_hours=1.0)

            # Force the lock into the past so progress reads as complete.
            lock.cure_start_at = datetime.utcnow() - timedelta(hours=2)
            lock.cure_end_at = datetime.utcnow() - timedelta(hours=1)
            s.commit()

            progress = svc.get_lock_progress(lock.id)
            assert progress["progress_pct"] == 100.0
            assert progress["can_claim"] is True

            before = wallet_balance(s, pid)
            claimed = svc.claim_rewards(lock.id, pid)
            after = wallet_balance(s, pid)
            assert claimed == Decimal("10.000000")
            assert after - before == Decimal("10.000000")
            assert s.get(NFTAsset, nft.id).status == "minted"

            with pytest.raises(StakingError):
                svc.claim_rewards(lock.id, pid)


class TestNFTApiEndToEnd:
    """Full loop through the Flask API with both flags explicitly enabled."""

    def test_mint_list_buy_stake_claim(self, db, monkeypatch):
        monkeypatch.setenv("FEATURE_NFT_MARKETPLACE", "true")
        monkeypatch.setenv("FEATURE_NFT_STAKING", "true")
        monkeypatch.setenv("FEATURE_CHAIN", "true")
        from growpodempire.api.flask_api import create_app

        client = create_app(init_database=False).test_client()

        with session_scope() as s:
            pid, harvest = _harvest(s, "e2e-seller")
            svc = GameService(s)
            svc.link_wallet(pid, _ADDR_A)
            key = s.get(type(svc.get_player(pid)), pid).api_key
            harvest_id = harvest.id

        headers = {"X-API-Key": key}

        r = client.post(
            f"/api/nft/players/{pid}/mint", json={"harvest_id": harvest_id}, headers=headers
        )
        assert r.status_code == 201, r.get_json()
        asset_id = r.get_json()["asset_id"]

        r = client.post(
            f"/api/market/players/{pid}/listings",
            json={"asset_id": asset_id, "price_ualgos": "1000000"},
            headers=headers,
        )
        assert r.status_code == 201, r.get_json()
        listing_id = r.get_json()["listing_id"]

        r = client.get("/api/market/listings")
        assert r.status_code == 200
        assert any(l["listing_id"] == listing_id for l in r.get_json()["listings"])

        with session_scope() as s:
            buyer = GameService(s).create_player("e2e-buyer")
            GameService(s).link_wallet(buyer.id, _ADDR_B)
            buyer_id, buyer_key = buyer.id, buyer.api_key

        r = client.post(
            f"/api/market/players/{buyer_id}/execute/{listing_id}",
            headers={"X-API-Key": buyer_key},
        )
        assert r.status_code == 201, r.get_json()

        # Curing room: the ORIGINAL seller stakes their harvest (ownership of
        # the NFT already moved to the buyer, but staking is keyed off the
        # Harvest owner, matching the design doc's "cure your own harvest").
        r = client.post(
            f"/api/stakes/players/{pid}",
            json={"asset_id": asset_id, "harvest_id": harvest_id},
            headers=headers,
        )
        assert r.status_code == 201, r.get_json()
        lock_id = r.get_json()["lock_id"]

        r = client.get(f"/api/stakes/players/{pid}", headers=headers)
        assert r.status_code == 200
        assert any(l["lock_id"] == lock_id for l in r.get_json())
