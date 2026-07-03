"""Full marketplace loop: mint -> list -> buy -> stake -> claim.

Two tests share one call sequence:

1. `test_mock_mint_list_buy_stake_claim_full_loop` — always runs (CI, `make
   test`, everyone's local run). Exercises the exact same service-layer
   sequence against the offline `MockChainProvider` that is this repo's
   default, so the wiring between NFTMintService / MarketplaceService /
   StakingService is under real test coverage with no network dependency.

2. `test_live_testnet_mint_list_buy_stake_claim_full_loop` — skipped unless
   the owner has supplied real TestNet credentials. This is the "does it
   actually work on real Algorand" proof asked for in
   `docs/memory/design/NFT_MARKETPLACE_SPEC.md`'s launch checklist ("E2E spec:
   mint -> list -> buy -> stake -> claim (full loop)"). See
   `docs/TESTNET_SETUP.md` for exactly what to set to unskip it.

Per CLAUDE.md ("CI runs with mocks — never require a live key in CI"), test #2
must never run unless explicitly opted into with real credentials, and test #1
must keep passing exactly as it does today regardless of #2's outcome.
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.chain import factory as chain_factory
from growpodempire.config import get_settings
from growpodempire.db.models import Strain, StakingLock
from growpodempire.services.game_service import GameService
from growpodempire.services.marketplace import MarketplaceService
from growpodempire.services.nft_mint import NFTMintService
from growpodempire.services.staking import StakingService


def _grow_a_harvest(session, username: str):
    """Grow + harvest a real Harvest row the normal way (mirrors
    tests/test_curing.py / test_gear_depreciation.py's fixture pattern) so the
    NFT mint below has genuine strain/player/terpene data behind it, not a
    hand-built stub."""
    svc = GameService(session)
    player = svc.create_player(username)
    strain = session.query(Strain).filter(Strain.slug == "white-widow").one()
    stack = svc.buy_seed(player.id, strain.id)
    pod = svc.create_pod(player.id, "E2E Tent", charge=False)
    plant = svc.plant_seed(player.id, stack.id, pod.id)
    harvest = svc.harvest_plant(player.id, plant.id, weight_g=100.0, quality=80.0, sell=False)
    return player, harvest


def test_mock_mint_list_buy_stake_claim_full_loop(db):
    """The reference loop, always run: proves the marketplace services compose
    correctly end-to-end. `shared_provider()` resolves to MockChainProvider by
    default (no ALGO_TREASURY_MNEMONIC in the test environment) -- this is the
    exact same factory-driven selection the live test below flips over to a
    real provider purely via config, per chain/factory.py."""
    from growpodempire.db.session import session_scope

    with session_scope() as s:
        seller, harvest = _grow_a_harvest(s, "e2e-mock-grower")
        seller.algorand_address = "SELLERMOCKADDRESSXYZ00000000000000000000000000000000001"
        seller_id = seller.id
        harvest_id = harvest.id
        seller_addr = seller.algorand_address

    # --- MINT --------------------------------------------------------------
    with session_scope() as s:
        nft = NFTMintService(s).mint_harvest(harvest_id, owner_address=seller_addr)
        asset_id = nft.asset_id
        assert nft.status == "minted"
        assert nft.mint_txid  # a real (mock) txid was recorded
        # Mint is idempotent on harvest_id: re-minting returns the same asset.
        again = NFTMintService(s).mint_harvest(harvest_id, owner_address=seller_addr)
        assert again.asset_id == asset_id

    # --- LIST ----------------------------------------------------------------
    with session_scope() as s:
        listing = MarketplaceService(s).create_listing(
            asset_id, seller_addr, price_ualgos=Decimal("1000000")
        )
        listing_id = listing.id
        assert listing.status == "active"

    # --- BUY -----------------------------------------------------------------
    buyer_addr = "BUYERMOCKADDRESSXYZ0000000000000000000000000000000000002"
    with session_scope() as s:
        mkt = MarketplaceService(s)
        trade = mkt.execute_trade(listing_id, buyer_addr)
        # The on-chain transfer: real call through the same provider the mint
        # used, moving the single unit from treasury to the buyer.
        provider = chain_factory.shared_provider()
        txid = provider.transfer_asset(asset_id, buyer_addr, 1)
        mkt.confirm_trade(trade.id, txid)
        trade_id = trade.id

    with session_scope() as s:
        from growpodempire.db.models import NFTAsset, NFTTrade

        nft = s.query(NFTAsset).filter_by(asset_id=asset_id).first()
        assert nft.owner_address == buyer_addr
        confirmed = s.query(NFTTrade).filter_by(id=trade_id).first()
        assert confirmed.status == "confirmed"
        assert confirmed.txid

    # --- STAKE -----------------------------------------------------------------
    # Staking authorization is keyed off the DB's harvest.player_id (the
    # original grower), independent of who currently holds the ASA on-chain —
    # that's how services/staking.py verifies ownership today. In production
    # the buyer's *own* harvest (from their own grow) is what they'd stake;
    # this test reuses the seller's player identity to stay inside the current
    # service contract rather than inventing a second Player + Harvest.
    with session_scope() as s:
        lock = StakingService(s).create_lock(
            asset_id, seller_id, harvest_id, cure_target_hours=0.001
        )
        lock_id = lock.id
        assert lock.status == "active"

    with session_scope() as s:
        from growpodempire.db.models import NFTAsset

        nft = s.query(NFTAsset).filter_by(asset_id=asset_id).first()
        assert nft.status == "staking"

    # Force the cure window closed instead of sleeping in a test.
    with session_scope() as s:
        lock = s.get(StakingLock, lock_id)
        lock.cure_end_at = datetime.utcnow() - timedelta(seconds=1)

    # --- CLAIM -----------------------------------------------------------------
    with session_scope() as s:
        stake_svc = StakingService(s)
        progress = stake_svc.get_lock_progress(lock_id)
        assert progress["can_claim"]
        reward = stake_svc.claim_rewards(lock_id, seller_id)
        assert reward >= Decimal("0")

    with session_scope() as s:
        from growpodempire.db.models import NFTAsset

        lock = s.get(StakingLock, lock_id)
        assert lock.status == "withdrawn"
        assert lock.rewards_claimed_at is not None
        nft = s.query(NFTAsset).filter_by(asset_id=asset_id).first()
        assert nft.status == "minted"  # released back after claim


# ---------------------------------------------------------------------------
# Live TestNet gate
# ---------------------------------------------------------------------------

def _live_creds_present() -> bool:
    run_flag = os.environ.get("RUN_LIVE_TESTNET_TESTS", "") == "1"
    treasury = os.environ.get("ALGO_TREASURY_MNEMONIC")
    buyer = os.environ.get("ALGO_TEST_BUYER_MNEMONIC")
    mock_forced = os.environ.get("USE_MOCK_CHAIN", "false").strip().lower() == "true"
    return bool(run_flag and treasury and buyer and not mock_forced)


_SKIP_REASON = (
    "Live TestNet e2e requires RUN_LIVE_TESTNET_TESTS=1, ALGO_TREASURY_MNEMONIC, and "
    "ALGO_TEST_BUYER_MNEMONIC (two funded Algorand TestNet accounts; USE_MOCK_CHAIN must "
    "not be true). Never set in CI. See docs/TESTNET_SETUP.md for how to create and fund "
    "both accounts via the public TestNet dispenser."
)


@pytest.fixture()
def _live_chain_env():
    """Force the process-wide chain provider singleton to re-resolve from the
    current environment for this test only, then restore it — mirrors the
    reset/restore pattern in test_providers_factory.py so this test never
    leaks a real-provider singleton into any test that runs after it."""
    chain_factory.reset_shared_provider()
    get_settings.cache_clear()
    try:
        yield
    finally:
        chain_factory.reset_shared_provider()
        get_settings.cache_clear()


@pytest.mark.skipif(not _live_creds_present(), reason=_SKIP_REASON)
def test_live_testnet_mint_list_buy_stake_claim_full_loop(db, _live_chain_env):
    """Identical loop to the mock test above, run against real Algorand
    TestNet. Requires two funded TestNet accounts (treasury + a second
    "buyer" account, since a real ASA transfer requires the receiver to have
    already opted in, and only the receiver's own key can do that)."""
    from algosdk import account, mnemonic as algo_mnemonic

    from growpodempire.chain.provider import ChainError
    from growpodempire.db.session import session_scope

    provider = chain_factory.shared_provider()
    # Sanity: confirm we really are talking to live TestNet, not the mock —
    # if this assertion ever fails, the loop below would silently be a no-op
    # rehearsal instead of proof against real infrastructure.
    assert provider.network() != "mock"

    buyer_mnemonic = os.environ["ALGO_TEST_BUYER_MNEMONIC"]
    buyer_sk = algo_mnemonic.to_private_key(buyer_mnemonic)
    buyer_addr = account.address_from_private_key(buyer_sk)

    with session_scope() as s:
        seller, harvest = _grow_a_harvest(s, "e2e-live-grower")
        seller.algorand_address = provider.treasury_addr
        seller_id = seller.id
        harvest_id = harvest.id

    # --- MINT: a real ASA is created and confirmed on TestNet ------------------
    with session_scope() as s:
        nft = NFTMintService(s).mint_harvest(harvest_id, owner_address=provider.treasury_addr)
        asset_id = nft.asset_id
        assert nft.mint_txid

    # Confirm on-chain, independent of what the DB recorded.
    info = provider.asset_info(asset_id)
    assert info.asset_id == asset_id
    assert info.total == 1

    # --- LIST --------------------------------------------------------------
    with session_scope() as s:
        listing = MarketplaceService(s).create_listing(
            asset_id, provider.treasury_addr, price_ualgos=Decimal("1000000")
        )
        listing_id = listing.id

    # --- BUY: buyer opts in (real 0-amount self-transfer), then treasury sends
    # the unit for real. A production buyer would sign this opt-in themselves
    # via Pera Wallet (web/src/lib/chain/algorand/wallet.ts); here the test
    # holds the buyer's key directly since there's no browser in this loop.
    provider.transfer_asset(asset_id, buyer_addr, 0, sender_mnemonic=buyer_mnemonic)
    txid = provider.transfer_asset(asset_id, buyer_addr, 1)
    with session_scope() as s:
        mkt = MarketplaceService(s)
        trade = mkt.execute_trade(listing_id, buyer_addr)
        mkt.confirm_trade(trade.id, txid)
        trade_id = trade.id

    with session_scope() as s:
        from growpodempire.db.models import NFTAsset, NFTTrade

        assert s.query(NFTAsset).filter_by(asset_id=asset_id).first().owner_address == buyer_addr
        assert s.query(NFTTrade).filter_by(id=trade_id).first().status == "confirmed"

    # --- STAKE (DB bookkeeping; see the mock test's docstring for why the
    # seller's player identity, not the buyer's, is used here) --------------
    with session_scope() as s:
        lock = StakingService(s).create_lock(
            asset_id, seller_id, harvest_id, cure_target_hours=0.001
        )
        lock_id = lock.id

    with session_scope() as s:
        lock = s.get(StakingLock, lock_id)
        lock.cure_end_at = datetime.utcnow() - timedelta(seconds=1)

    # --- CLAIM ---------------------------------------------------------------
    with session_scope() as s:
        stake_svc = StakingService(s)
        assert stake_svc.get_lock_progress(lock_id)["can_claim"]
        reward = stake_svc.claim_rewards(lock_id, seller_id)
        assert reward >= Decimal("0")

    # Best-effort cleanup so repeated live runs don't accumulate test assets
    # on the treasury account. Never fails the test if cleanup itself fails.
    try:
        provider.transfer_asset(asset_id, provider.treasury_addr, 1, sender_mnemonic=buyer_mnemonic)
        provider.destroy_asset(asset_id)
    except ChainError:
        pass
