"""The three owner-ratified pre-live deltas, gated to the LAUNCH profile:

  1. harvest payout cap        (harvest_sale.max_payout_grow)
  2. mint sink                 (chain.nft.mint_fee_grow)
  3. Cup prize bounded to pool (cannabis_cup.bound_prizes_to_pool)

Each must take effect under the launch profile and leave the free-playtest profile
unchanged.
"""

import copy
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain, CupEntry, Harvest
from growpodempire.economy import pricing
from growpodempire.economy.config import EconomyConfig, load_economy_config
from growpodempire.economy.ledger import balance, InsufficientFundsError
from growpodempire.enums import NFTStatus, LedgerEntryType
from growpodempire.services.game_service import GameService
from growpodempire.services.minting_service import MintingService
from growpodempire.services.cup_service import CupService
from growpodempire.chain.mock import MockChainProvider
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2026, 1, 1)
LATE = BASE + timedelta(days=91)

PLAYTEST = load_economy_config(profile="playtest")
LAUNCH = load_economy_config(profile="launch")


def _harvest(svc, pid, slug="gorilla-glue-no-4", grams=100, quality=90):
    strain = svc.session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(pid, strain.id)
    pod = svc.create_pod(pid, "Tent", charge=False)
    plant = svc.plant_seed(pid, stack.id, pod.id)
    return svc.harvest_plant(pid, plant.id, weight_g=grams, quality=quality, sell=False)


# ----- 1. harvest payout cap -------------------------------------------------
def test_harvest_cap_applies_under_launch_only():
    # A maximal legendary harvest: uncapped in playtest, ceilinged in launch.
    args = dict(thc_actual=30.0, terpene_intensity=1.0)
    play = pricing.harvest_value(100_000, 100, "legendary", PLAYTEST, **args)
    launch = pricing.harvest_value(100_000, 100, "legendary", LAUNCH, **args)
    cap = Decimal(str(LAUNCH.harvest["max_payout_grow"]))
    assert play > cap                       # playtest is uncapped
    assert launch == cap                    # launch is clamped to the ceiling


def test_normal_harvest_under_cap_is_unchanged():
    # A typical rare sale is well under the cap, so the ceiling doesn't distort it.
    play = pricing.harvest_value(100, 90, "rare", PLAYTEST, thc_actual=20)
    launch = pricing.harvest_value(100, 90, "rare", LAUNCH, thc_actual=20)
    assert launch == play
    assert launch < Decimal(str(LAUNCH.harvest["max_payout_grow"]))


# ----- 2. mint sink ----------------------------------------------------------
def test_mint_charges_fee_under_launch(session):
    svc = GameService(session)
    p = svc.create_player("minter")
    h = _harvest(svc, p.id)
    before = balance(session, p.id)
    MintingService(session, provider=MockChainProvider(), config=LAUNCH).mint_harvest(p.id, h.id)
    fee = Decimal(str(LAUNCH.raw["chain"]["nft"]["mint_fee_grow"]))
    assert before - balance(session, p.id) == fee
    from growpodempire.db.models import LedgerEntry
    paid = (
        session.query(LedgerEntry)
        .filter(
            LedgerEntry.player_id == p.id,
            LedgerEntry.entry_type == LedgerEntryType.MINT_FEE.value,
        )
        .count()
    )
    assert paid == 1


def test_mint_is_free_under_playtest(session):
    svc = GameService(session)
    p = svc.create_player("freeminter")
    h = _harvest(svc, p.id)
    before = balance(session, p.id)
    MintingService(session, provider=MockChainProvider(), config=PLAYTEST).mint_harvest(p.id, h.id)
    assert balance(session, p.id) == before  # no fee in the free-playtest profile


def test_mint_fee_insufficient_funds_blocks_and_does_not_mint(session):
    svc = GameService(session)
    p = svc.create_player("brokeminter")
    h = _harvest(svc, p.id)
    raw = copy.deepcopy(LAUNCH.raw)
    raw["chain"]["nft"]["mint_fee_grow"] = 1_000_000  # exceeds any balance
    provider = MockChainProvider()
    with pytest.raises(InsufficientFundsError):
        MintingService(session, provider=provider, config=EconomyConfig(raw=raw)).mint_harvest(p.id, h.id)
    assert len(provider.assets) == 0  # chain never called — fee precedes mint
    assert session.get(Harvest, h.id).nft_status != NFTStatus.MINTED.value


# ----- 3. Cup prize bounded to entry-fee pool --------------------------------
def _run_cup(session, cfg):
    svc = GameService(session)
    players = [svc.create_player(f"cup{i}") for i in range(3)]
    cup = CupService(session, config=cfg, clock=FrozenClock(BASE))
    for i, p in enumerate(players):
        cup.enter(p.id, _harvest(svc, p.id, grams=100 + i * 10, quality=70 + i * 10).id)
    pool = cup.current_cup().prize_pool
    judged = CupService(session, config=cfg, clock=FrozenClock(LATE)).current_cup()
    assert judged.status == "judged"
    total_paid = sum(
        (e.prize_grow or Decimal("0"))
        for e in session.query(CupEntry).filter(CupEntry.cup_id == judged.id).all()
    )
    return pool, total_paid


def test_cup_prizes_bounded_to_pool_under_launch(session):
    pool, total_paid = _run_cup(session, LAUNCH)
    assert total_paid <= pool, "launch Cup paid out more than it collected (net faucet)"


def test_cup_unbounded_under_playtest(session):
    # The pre-existing behavior: fixed prizes can exceed the collected pool. This
    # is the leak the launch bound closes (and proves the bound is profile-gated).
    pool, total_paid = _run_cup(session, PLAYTEST)
    assert total_paid > pool
