"""Disruptor-sweep NFT/staking economy fixes (findings #2, #3, #7, #8, #16, #18).

Companion to test_nft_marketplace.py (the happy-path + pre-existing negative
tests, updated in the same change for the ownership-authz switch). This file
covers the NEW guards specifically: the ones with no prior test coverage
because the underlying bugs meant there was nothing to guard against yet.
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.db.session import get_sessionmaker
from growpodempire.db.models import NFTAsset, Strain
from growpodempire.services.game_service import GameService
from growpodempire.services.nft_mint import NFTMintService, NFTMintError
from growpodempire.services.marketplace import MarketplaceService, MarketplaceError
from growpodempire.services.staking import StakingService, StakingError
from algosdk import account as _algo_account

_ADDR_A = _algo_account.generate_account()[1]
_ADDR_B = _algo_account.generate_account()[1]


def _rare_harvest(s, username, sell=False):
    """A rare (mint-eligible) harvest, unsold by default."""
    svc = GameService(s)
    p = svc.create_player(username)
    strain = s.query(Strain).filter_by(slug="gorilla-glue-no-4").first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    plant.growth_stage = "flowering"
    plant.health = 90.0
    from datetime import datetime
    now = datetime.utcnow()
    plant.last_tick_at = now
    plant.stage_entered_at = now
    s.flush()
    harvest = svc.harvest_plant(p.id, plant.id, sell=sell)
    return p.id, harvest


def test_cannot_mint_a_harvest_that_was_already_sold(session):
    """Disruptor-sweep finding #3: selling a harvest posts NPC-market GC and
    stamps sold=True; minting it afterward would let the same harvest pay out
    a second time (marketplace ALGO + a staking bonus on top)."""
    pid, harvest = _rare_harvest(session, "sold-then-mint", sell=True)
    assert harvest.sold is True
    with pytest.raises(NFTMintError, match="already been sold"):
        NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)


def test_cannot_restake_an_nft_after_claiming_its_reward(session):
    """Disruptor-sweep finding #2: staking is a one-shot bonus per asset, not a
    repeatable faucet. Stake -> claim -> re-stake the SAME asset must reject."""
    from datetime import datetime, timedelta

    pid, harvest = _rare_harvest(session, "restaker")
    harvest.sale_value = Decimal("100.00")
    session.commit()
    GameService(session).link_wallet(pid, _ADDR_A)
    nft = NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)

    svc = StakingService(session)
    lock = svc.create_lock(nft.asset_id, pid, harvest.id, cure_target_hours=1.0)
    lock.cure_start_at = datetime.utcnow() - timedelta(hours=2)
    lock.cure_end_at = datetime.utcnow() - timedelta(hours=1)
    session.commit()

    # get_lock_progress() is what flips ACTIVE -> COMPLETE once cure_end_at has
    # passed (mirrors test_progress_completes_and_claim_pays_ledger).
    progress = svc.get_lock_progress(lock.id)
    assert progress["can_claim"] is True

    svc.claim_rewards(lock.id, pid)
    assert session.get(NFTAsset, nft.id).staked_once is True

    with pytest.raises(StakingError, match="already completed a staking cure"):
        svc.create_lock(nft.asset_id, pid, harvest.id)


def test_create_lock_rejects_non_positive_cure_hours(session):
    """Disruptor-sweep finding #16: mirrors GameService.start_cure's own
    validation, which create_lock previously skipped entirely."""
    pid, harvest = _rare_harvest(session, "zerohours")
    harvest.sale_value = Decimal("50.00")
    session.commit()
    GameService(session).link_wallet(pid, _ADDR_A)
    nft = NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)

    with pytest.raises(StakingError, match="must be positive"):
        StakingService(session).create_lock(nft.asset_id, pid, harvest.id, cure_target_hours=0)
    with pytest.raises(StakingError, match="must be positive"):
        StakingService(session).create_lock(nft.asset_id, pid, harvest.id, cure_target_hours=-5)


def test_create_lock_clamps_an_excessive_cure_hours(session):
    pid, harvest = _rare_harvest(session, "toolonghours")
    harvest.sale_value = Decimal("50.00")
    session.commit()
    GameService(session).link_wallet(pid, _ADDR_A)
    nft = NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)

    lock = StakingService(session).create_lock(
        nft.asset_id, pid, harvest.id, cure_target_hours=100_000
    )
    assert lock.cure_target_hours == 720.0  # the default max_cure_hours ceiling


def test_confirm_trade_rejects_a_non_pending_trade(session):
    """Disruptor-sweep finding #18: confirm_trade/fail_trade are currently
    unreachable via HTTP (no route calls them yet -- a not-yet-built
    reconciliation step), but the service itself shouldn't trust trade.status
    is always PENDING when called."""
    pid, harvest = _rare_harvest(session, "trade-seller")
    GameService(session).link_wallet(pid, _ADDR_A)
    nft = NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)

    svc = MarketplaceService(session)
    listing = svc.create_listing(nft.asset_id, _ADDR_A, Decimal("1000000"))
    trade = svc.execute_trade(listing.id, _ADDR_B)
    assert trade.status == "pending"

    svc.confirm_trade(trade.id, "MOCKTXID123")
    assert trade.status == "confirmed"

    # Second confirm (or a fail) on an already-CONFIRMED trade must reject --
    # otherwise fail_trade would wrongly revert a settled sale's ownership.
    with pytest.raises(MarketplaceError, match="cannot confirm"):
        svc.confirm_trade(trade.id, "MOCKTXID456")
    with pytest.raises(MarketplaceError, match="cannot fail"):
        svc.fail_trade(trade.id, "some error")


def test_nft_asset_version_lock_serializes_concurrent_stakes(session):
    """Disruptor-sweep finding #8: NFTAsset now carries the same optimistic
    lock pattern as NFTListing/Wallet/Harvest. Mirrors test_concurrency.py's
    wallet race and test_marketplace_concurrency.py's listing race: two
    sessions read the same version, each writes the same status transition
    `create_lock` performs, and only one commit can win.

    (`create_lock` itself commits internally, so calling it twice sequentially
    wouldn't race -- the second call would see the first's already-committed
    status and hit the "already staked" business-logic guard instead of the
    version conflict. Driving the raw ORM write directly is what actually
    proves the `version_id_col` mechanism, independent of any one caller.)
    """
    pid, harvest = _rare_harvest(session, "racer")
    harvest.sale_value = Decimal("100.00")
    session.commit()
    GameService(session).link_wallet(pid, _ADDR_A)
    nft = NFTMintService(session).mint_harvest(pid, harvest.id, _ADDR_A)
    asset_id = nft.asset_id
    session.commit()

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        nft1 = s1.query(NFTAsset).filter_by(asset_id=asset_id).first()
        nft2 = s2.query(NFTAsset).filter_by(asset_id=asset_id).first()
        nft1.status = "staking"
        nft2.status = "staking"

        s1.commit()  # winner: nft_assets version N -> N+1
        with pytest.raises(StaleDataError):
            s2.commit()  # WHERE version=N matches 0 rows -> stale
        s2.rollback()
    finally:
        s1.close()
        s2.close()
