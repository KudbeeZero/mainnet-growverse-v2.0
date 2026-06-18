"""Economy: deterministic pricing + ledger invariants."""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.economy.config import load_economy_config
from growpodempire.economy import pricing
from launch_economy import launch_config, launch_overrides
from growpodempire.economy.ledger import (
    post,
    balance,
    recompute_balance,
    InsufficientFundsError,
    to_money,
)
from growpodempire.enums import LedgerEntryType
from growpodempire.db.models import Player, Wallet


CFG = load_economy_config()
# Launch config: live balance.yaml is in "free testing mode"; LAUNCH_CFG overlays
# the canonical launch values so launch pricing math stays guarded.
LAUNCH_CFG = launch_config()


# ----- Launch-value tripwire --------------------------------------------
def test_launch_balance_values():
    """Keeps tests/fixtures/launch_balance.yaml honest — the values to RESTORE in
    balance.yaml before launch. If these drift, the guard below must be updated
    deliberately (it is the 'restore before launch' contract)."""
    over = launch_overrides()
    assert over["daily_stipend"] == 50
    assert over["seeds"]["base_cost"] == 25
    mult = over["seeds"]["rarity_multiplier"]
    assert set(mult) == {"common", "uncommon", "rare", "epic", "legendary"}
    assert [mult[r] for r in ("common", "uncommon", "rare", "epic", "legendary")] == [
        1.0,
        2.5,
        6.0,
        15.0,
        40.0,
    ]


# Seed pricing is intentionally disabled in the current free-playtest economy
# (balance.yaml `seeds.base_cost: 0  # FREE for testing — restore to 25 before
# launch`). These tests guard the LAUNCH economy: they skip while seeds are free
# and auto-reactivate the moment base_cost is restored. See DECISIONS 2026-06-18.
_FREE_SEED_REASON = "dev free-seed economy (balance.yaml seeds.base_cost: 0); restore to 25 to enforce launch pricing"


# ----- Pricing (pure, deterministic) ------------------------------------
@pytest.mark.skipif(CFG.seed_base_cost() == 0, reason=_FREE_SEED_REASON)
def test_seed_price_scales_with_rarity():
    assert pricing.seed_price("common", LAUNCH_CFG) == Decimal("25.000000")
    assert pricing.seed_price("legendary", LAUNCH_CFG) == Decimal("1000.000000")


def test_breeding_fee_scales_with_avg_rarity():
    assert pricing.breeding_fee("common", "common", CFG) == Decimal("75.000000")
    # common(0) + rare(2) -> avg tier 1.0 -> 75 + 40
    assert pricing.breeding_fee("common", "rare", CFG) == Decimal("115.000000")


def test_harvest_value_baseline():
    # 100g, quality 100, common, THC 15 -> 100 * 2.0 * 1 * 1 * 1
    assert pricing.harvest_value(100, 100, "common", CFG, thc_actual=15) == Decimal(
        "200.000000"
    )


def test_harvest_value_diminishing_returns_above_soft_cap():
    # 200g: effective = 120 + (200-120)*0.6 = 168 -> 168 * 2
    assert pricing.harvest_value(200, 100, "common", CFG, thc_actual=15) == Decimal(
        "336.000000"
    )


def test_harvest_value_rewards_rarity_and_thc():
    common = pricing.harvest_value(100, 90, "common", CFG, thc_actual=15)
    legendary = pricing.harvest_value(100, 90, "legendary", CFG, thc_actual=25)
    assert legendary > common


# ----- Ledger -----------------------------------------------------------
def _make_player(session, balance_amount=0):
    player = Player(username="ledger_tester")
    session.add(player)
    session.flush()
    session.add(Wallet(player_id=player.id, cached_balance=Decimal("0")))
    session.flush()
    if balance_amount:
        post(session, player.id, balance_amount, LedgerEntryType.STARTING_GRANT)
    return player


def test_post_updates_balance_and_records_entry(session):
    player = _make_player(session)
    post(session, player.id, 500, LedgerEntryType.STARTING_GRANT)
    assert balance(session, player.id) == Decimal("500.000000")
    post(session, player.id, -125, LedgerEntryType.SEED_PURCHASE)
    assert balance(session, player.id) == Decimal("375.000000")


def test_cached_balance_matches_ledger_sum(session):
    player = _make_player(session, 1000)
    for amt, t in [
        (-25, LedgerEntryType.SEED_PURCHASE),
        (-75, LedgerEntryType.BREEDING_FEE),
        (200, LedgerEntryType.HARVEST_SALE),
        (-5, LedgerEntryType.NUTRIENT_PURCHASE),
    ]:
        post(session, player.id, amt, t)
    assert balance(session, player.id) == recompute_balance(session, player.id)


def test_overdraw_raises(session):
    player = _make_player(session, 10)
    with pytest.raises(InsufficientFundsError):
        post(session, player.id, -50, LedgerEntryType.SEED_PURCHASE)
    # Balance unchanged after the failed debit.
    assert balance(session, player.id) == Decimal("10.000000")


def test_to_money_quantizes():
    assert to_money("1.2345678") == Decimal("1.234568")
