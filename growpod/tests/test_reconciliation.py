"""Chain <-> DB reconciliation: catches drift with a manufactured mismatch.

Companion to test_chain.py; exercises services/reconciliation.py against the
offline MockChainProvider — no network, no real credentials required. The
live-chain version of this concern (does the real Algod node agree with the
DB) is covered manually/by the (gated) live TestNet suite; this file proves
the comparison *logic* itself is correct.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.chain.mock import MockChainProvider
from growpodempire.db.models import NFTAsset
from growpodempire.services.reconciliation import reconcile_nft_assets


def _nft_row(asset_id: int, game_item_id: str, status: str = "minted") -> NFTAsset:
    return NFTAsset(
        asset_id=asset_id,
        asset_type="HARVEST",
        owner_address="TREASURY",
        game_item_id=game_item_id,
        mint_txid=f"MOCKTX{asset_id:010d}",
        status=status,
    )


def test_reconcile_is_clean_when_db_and_chain_agree(session):
    provider = MockChainProvider()
    asset_id = provider.create_asset(
        unit_name="GPHARVEST", asset_name="Real Harvest", total=1, decimals=0
    )
    session.add(_nft_row(asset_id, "harvest-real"))
    session.commit()

    report = reconcile_nft_assets(session, provider=provider)

    assert report.checked == 1
    assert report.ok
    assert report.drifted == []


def test_reconcile_flags_a_mint_the_db_thinks_succeeded_but_chain_never_confirmed(session):
    """The exact drift case from NFT_MARKETPLACE_SPEC.md: a DB row claims
    status="minted" for an asset id that the chain (mock, standing in for
    Algod) has no record of — e.g. the process crashed between
    `create_asset_tx()` returning and the DB commit."""
    provider = MockChainProvider()
    real_asset_id = provider.create_asset(
        unit_name="GPHARVEST", asset_name="Real Harvest", total=1, decimals=0
    )
    drifted_asset_id = real_asset_id + 999  # never created on this provider

    session.add(_nft_row(real_asset_id, "harvest-real"))
    session.add(_nft_row(drifted_asset_id, "harvest-drifted"))
    session.commit()

    report = reconcile_nft_assets(session, provider=provider)

    assert report.checked == 2
    assert not report.ok
    assert len(report.drifted) == 1

    drift = report.drifted[0]
    assert drift.asset_id == drifted_asset_id
    assert drift.game_item_id == "harvest-drifted"
    assert drift.kind == "missing_on_chain"
    assert drift.chain_value is None


def test_reconcile_flags_asset_destroyed_on_chain_after_the_db_recorded_it(session):
    """A second real-world drift shape: the DB still thinks the asset is
    live, but it was later destroyed on-chain (e.g. via reset_asa.py or a
    manual admin action) without the DB being told."""
    provider = MockChainProvider()
    asset_id = provider.create_asset(
        unit_name="GPHARVEST", asset_name="Doomed Harvest", total=1, decimals=0
    )
    session.add(_nft_row(asset_id, "harvest-destroyed", status="listed"))
    session.commit()

    provider.destroy_asset(asset_id)  # chain moves on; DB is never told

    report = reconcile_nft_assets(session, provider=provider)

    assert report.checked == 1
    assert not report.ok
    assert report.drifted[0].kind == "missing_on_chain"


def test_reconcile_ignores_rows_whose_status_is_not_live(session):
    """A status outside the tracked set (default: minted/listed/staking/traded)
    is skipped entirely, even if it would otherwise drift — it's not a status
    the DB believes implies on-chain existence."""
    provider = MockChainProvider()
    session.add(_nft_row(999999, "harvest-cancelled", status="cancelled"))
    session.commit()

    report = reconcile_nft_assets(session, provider=provider)

    assert report.checked == 0
    assert report.ok


def test_reconcile_flags_unexpected_total_supply(session):
    """An NFT invariant check: a 1-of-1 asset whose on-chain total isn't 1
    (e.g. it was accidentally created as a fungible-style token) is drift
    even though the chain lookup itself succeeds."""
    provider = MockChainProvider()
    # Bypass the normal 1-of-1 helper to simulate a misconfigured mint.
    asset_id = provider.create_asset(
        unit_name="GPHARVEST", asset_name="Bad Total", total=5, decimals=0
    )
    session.add(_nft_row(asset_id, "harvest-bad-total"))
    session.commit()

    report = reconcile_nft_assets(session, provider=provider)

    assert report.checked == 1
    assert not report.ok
    assert report.drifted[0].kind == "unexpected_total"
