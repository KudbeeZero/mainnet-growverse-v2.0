"""NFT minting: eligibility, idempotency, DB<->chain wiring (mock chain)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.enums import NFTStatus, Rarity, LineageType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.minting_service import MintingService
from growpodempire.chain.mock import MockChainProvider
from growpodempire.genetics.traits import genome_from_traits
from algosdk import account as _algo_account
from _wallet_test_helpers import link_wallet_for_test
_VALID_PRIV, _VALID_ADDR = _algo_account.generate_account()  # checksum-valid test keypair


def _harvest_of(s, slug):
    svc = GameService(s)
    p = svc.create_player("minter")
    strain = s.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    # sell=False: these tests are about MINTING, not selling -- harvest_plant's
    # own default (sell=True) would auto-sell it first, tripping the
    # disruptor-sweep sold-harvest mint guard (MintingService.mint_harvest).
    harvest = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=90, sell=False)
    return p.id, harvest


def test_mint_rare_harvest(db):
    with session_scope() as s:
        pid, harvest = _harvest_of(s, "gorilla-glue-no-4")  # rare
        provider = MockChainProvider()
        minted = MintingService(s, provider=provider).mint_harvest(pid, harvest.id)
        assert minted.nft_status == NFTStatus.MINTED.value
        assert minted.nft_asset_id is not None
        assert minted.nft_asset_id in provider.assets


def test_mint_common_harvest_rejected(db):
    with session_scope() as s:
        pid, harvest = _harvest_of(s, "blue-dream")  # common
        with pytest.raises(GameError):
            MintingService(s, provider=MockChainProvider()).mint_harvest(pid, harvest.id)


def test_mint_is_idempotent(db):
    with session_scope() as s:
        pid, harvest = _harvest_of(s, "gorilla-glue-no-4")
        provider = MockChainProvider()
        svc = MintingService(s, provider=provider)
        first = svc.mint_harvest(pid, harvest.id).nft_asset_id
        second = svc.mint_harvest(pid, harvest.id).nft_asset_id
        assert first == second
        assert len(provider.assets) == 1  # not minted twice


def test_mint_strain_requires_stability_and_rarity(db):
    with session_scope() as s:
        svc = GameService(s)
        player = svc.create_player("breeder")
        # An unstable fresh cross should be rejected.
        a = s.query(Strain).filter(Strain.slug == "haze").one()
        b = s.query(Strain).filter(Strain.slug == "afghani").one()
        fresh = svc.breed(player.id, a.id, b.id, rng_seed=1)
        with pytest.raises(GameError):
            MintingService(s, provider=MockChainProvider()).mint_strain(player.id, fresh.id)

        # A stabilized, rare, player-bred strain mints fine.
        stable = Strain(
            name="Champion Line",
            slug="champion-line",
            lineage_type=LineageType.BRED.value,
            rarity=Rarity.EPIC.value,
            indica_ratio=0.5, thc_min=27, thc_max=28, cbd_min=0.3, cbd_max=0.5,
            flowering_days_min=60, flowering_days_max=62, yield_min=500, yield_max=520,
            difficulty=3, terpenes=["limonene"],
            genome=genome_from_traits({"thc": 28, "yield": 600}),
            stability=0.92, generation=4, is_base_catalog=False,
            created_by_player_id=player.id,
        )
        s.add(stable)
        s.flush()
        minted = MintingService(s, provider=MockChainProvider()).mint_strain(player.id, stable.id)
        assert minted.nft_status == NFTStatus.MINTED.value
        assert minted.nft_asset_id is not None


def test_link_wallet(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("walletuser")
        link_wallet_for_test(svc, p.id, _VALID_PRIV, _VALID_ADDR)
        assert svc.get_player(p.id).algorand_address == _VALID_ADDR


def test_cannot_mint_while_curing(db):
    """C5/D4: Block mint while curing — metadata should snapshot final quality."""
    from growpodempire.simulation.clock import FrozenClock
    from datetime import datetime

    clock = FrozenClock(datetime(2025, 1, 1))
    with session_scope() as s:
        pid, harvest = _harvest_of(s, "gorilla-glue-no-4")  # rare
        svc = GameService(s, clock=clock)
        svc.start_cure(pid, harvest.id, target_hours=72)
        assert harvest.cure_status == "curing"

        # Should reject mint while curing
        with pytest.raises(GameError, match="Cannot mint a harvest while it is curing"):
            MintingService(s).mint_harvest(pid, harvest.id)


def test_pending_self_heal_with_asset_id(db):
    """C6: PENDING self-heal on retry — if asset_id is set, mark as MINTED."""
    with session_scope() as s:
        pid, harvest = _harvest_of(s, "gorilla-glue-no-4")
        provider = MockChainProvider()
        svc = MintingService(s, provider=provider)

        # First mint succeeds
        minted = svc.mint_harvest(pid, harvest.id)
        assert minted.nft_status == NFTStatus.MINTED.value
        asset_id = minted.nft_asset_id

        # Simulate a crash that left PENDING with asset_id
        harvest.nft_status = NFTStatus.PENDING.value
        s.commit()

        # Next retry should see asset_id and mark as MINTED
        recovered = MintingService(s, provider=provider).mint_harvest(pid, harvest.id)
        assert recovered.nft_status == NFTStatus.MINTED.value
        assert recovered.nft_asset_id == asset_id
