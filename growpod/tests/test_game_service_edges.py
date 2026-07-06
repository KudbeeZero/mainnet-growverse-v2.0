"""Edge-case + error-branch coverage for the GameService layer.

These target the uncovered branches of services/game_service.py: error raises
(GameError: not found / capacity / invalid state / bad input), the pod
upgrade/downgrade path, gear buy/equip edges, curing lifecycle, the
marketplace/auction error paths, and a few read helpers. Operates on the
service layer directly (not HTTP), following test_game_service.py / test_gear.py.
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Plant
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation.clock import FrozenClock
from launch_economy import launch_config
from algosdk import account as _algo_account
from _wallet_test_helpers import link_wallet_for_test
_VALID_PRIV, _VALID_ADDR = _algo_account.generate_account()  # checksum-valid test keypair

LAUNCH_CFG = launch_config()
BASE = datetime(2025, 1, 1)


def _strain(session, slug):
    return session.query(Strain).filter(Strain.slug == slug).one()


def _fund(s, player_id, amount=5000):
    post(s, player_id, Decimal(str(amount)), LedgerEntryType.REWARD, ref_type="test")
    s.flush()


# ----- Players & wallets -------------------------------------------------
def test_create_player_duplicate_username_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        svc.create_player("dup")
        with pytest.raises(GameError):
            svc.create_player("dup")


def test_create_player_blank_username_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            GameService(s).create_player("   ")


def test_create_player_duplicate_email_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        svc.create_player("a", email="x@example.com")
        with pytest.raises(GameError):
            svc.create_player("b", email="x@example.com")


def test_get_player_unknown_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            GameService(s).get_player("nope")


def test_link_wallet_requires_address(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("linker")
        with pytest.raises(GameError):
            svc.link_wallet(p.id, "", "", "")
        updated = link_wallet_for_test(svc, p.id, _VALID_PRIV, _VALID_ADDR)
        assert updated.algorand_address == _VALID_ADDR


def test_get_wallet_found_and_missing(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("walleted")
        assert svc.get_wallet(p.id).player_id == p.id
        with pytest.raises(GameError):
            svc.get_wallet("ghost")


def test_get_ledger_returns_entries(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("ledgered")
        s.flush()
        entries = svc.get_ledger(p.id)
        # The starting grant is at least one entry.
        assert any(e.player_id == p.id for e in entries)


# ----- Strains & seeds ---------------------------------------------------
def test_list_strains_filters(db):
    with session_scope() as s:
        svc = GameService(s)
        # Exercise catalog_only + q + rarity + lineage_type + thc/indica filters.
        out = svc.list_strains(
            catalog_only=True,
            q="dream",
            rarity="common",
            lineage_type="hybrid",
            min_thc=0.0,
            max_thc=99.0,
            min_indica=0.0,
            max_indica=1.0,
        )
        assert all(x.is_base_catalog for x in out)


def test_get_strain_unknown_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            GameService(s).get_strain("missing")


def test_get_seed_inventory_returns_positive_stacks(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("seeded")
        strain = _strain(s, "blue-dream")
        svc.buy_seed(p.id, strain.id, quantity=2)
        s.flush()
        inv = svc.get_seed_inventory(p.id)
        assert sum(stack.quantity for stack in inv) == 2


def test_buy_seed_quantity_must_be_positive(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("badqty")
        strain = _strain(s, "blue-dream")
        with pytest.raises(GameError):
            svc.buy_seed(p.id, strain.id, quantity=0)


# ----- Consumables & gear -------------------------------------------------
def test_buy_consumable_quantity_must_be_positive(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("cons0")
        with pytest.raises(GameError):
            svc.buy_consumable(p.id, "anything", quantity=0)


def test_buy_consumable_unknown_key_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("cons1")
        with pytest.raises(GameError):
            svc.buy_consumable(p.id, "no_such_item")


def test_buy_gear_quantity_must_be_positive(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("gear0")
        with pytest.raises(GameError):
            svc.buy_gear(p.id, "led_125w", quantity=0)


def test_equip_unknown_gear_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("equip0")
        pod = svc.create_pod(p.id, "Room", charge=False)
        with pytest.raises(GameError):
            svc.equip_light(p.id, pod.id, "nonexistent_gear")


def test_equip_light_pod_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("equip1")
        svc.buy_gear(p.id, "led_125w", 1)
        with pytest.raises(GameError):
            svc.equip_light(p.id, "no-such-pod", "led_125w")


# ----- Pods: upgrade -----------------------------------------------------
def test_upgrade_pod_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("up0")
        with pytest.raises(GameError):
            svc.upgrade_pod(p.id, "no-pod", "pro")


def test_upgrade_pod_unknown_tier(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("up1")
        pod = svc.create_pod(p.id, "Room", tier="basic", charge=False)
        with pytest.raises(GameError):
            svc.upgrade_pod(p.id, pod.id, "ultra")


def test_upgrade_pod_must_be_an_upgrade(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        p = svc.create_player("up2")
        _fund(s, p.id)
        pod = svc.create_pod(p.id, "Room", tier="pro", charge=False)
        # Downgrading pro -> basic is not an upgrade.
        with pytest.raises(GameError):
            svc.upgrade_pod(p.id, pod.id, "basic")


def test_upgrade_pod_success_changes_tier_and_charges(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        p = svc.create_player("up3")
        _fund(s, p.id)
        pod = svc.create_pod(p.id, "Room", tier="basic", charge=False)
        before = balance(s, p.id)
        out = svc.upgrade_pod(p.id, pod.id, "pro")
        assert out.tier == "pro"
        assert out.auto_water is True and out.auto_feed is True
        assert balance(s, p.id) < before  # paid the tier delta


# ----- Planting errors ---------------------------------------------------
def test_plant_seed_not_in_inventory(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("plant0")
        pod = svc.create_pod(p.id, "Room", charge=False)
        with pytest.raises(GameError):
            svc.plant_seed(p.id, "no-seed", pod.id)


def test_plant_seed_empty_stack(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("plant1")
        strain = _strain(s, "white-widow")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", capacity=2, charge=False)
        svc.plant_seed(p.id, stack.id, pod.id)  # consumes the one seed
        with pytest.raises(GameError):
            svc.plant_seed(p.id, stack.id, pod.id)  # stack now empty


def test_plant_seed_pod_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("plant2")
        strain = _strain(s, "white-widow")
        stack = svc.buy_seed(p.id, strain.id)
        with pytest.raises(GameError):
            svc.plant_seed(p.id, stack.id, "no-pod")


# ----- Harvest errors + cleanup ------------------------------------------
def test_harvest_plant_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("harv0")
        with pytest.raises(GameError):
            svc.harvest_plant(p.id, "no-plant")


def test_harvest_already_harvested(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("harv1")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80)
        with pytest.raises(GameError):
            svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80)


def test_cleanup_plant_requires_harvest_or_death(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean0")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        # Alive + not harvested -> cannot clean up.
        with pytest.raises(GameError):
            svc.cleanup_plant(p.id, plant.id)


def test_cleanup_plant_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean1")
        with pytest.raises(GameError):
            svc.cleanup_plant(p.id, "no-plant")


def test_cleanup_dead_plant_archives_it(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean2")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        # Mark it dead so cleanup is allowed.
        plant.is_alive = False
        s.flush()
        before = balance(s, p.id)
        svc.cleanup_plant(p.id, plant.id, cleanup_cost=25)
        # Archived, NOT deleted — the row (and any Harvest/CupEntry referencing
        # it) must survive; only archived_at flips and it drops out of listings.
        archived = s.get(Plant, plant.id)
        assert archived is not None
        assert archived.archived_at is not None
        assert balance(s, p.id) == before - Decimal("25")
        assert archived.id not in [pl.id for pl in svc.list_plants(p.id)]


def test_cleanup_plant_preserves_harvest_record(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean3")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        harvest = svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80, sell=False)
        svc.cleanup_plant(p.id, plant.id)
        # The harvest row (and anything referencing it, e.g. a Cup entry) must
        # still resolve after the pod is cleaned up.
        from growpodempire.db.models import Harvest
        assert s.get(Harvest, harvest.id) is not None


def test_cleanup_plant_twice_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean4")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        plant.is_alive = False
        s.flush()
        svc.cleanup_plant(p.id, plant.id)
        with pytest.raises(GameError):
            svc.cleanup_plant(p.id, plant.id)


def test_cleanup_plant_default_cost_from_balance_yaml(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean5")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        plant.is_alive = False
        s.flush()
        before = balance(s, p.id)
        svc.cleanup_plant(p.id, plant.id)  # no explicit cost -> reads balance.yaml
        expected = svc.cfg.raw["simulation"]["actions"]["pod_cleanup"]["cost"]
        assert balance(s, p.id) == before - Decimal(str(expected))


def test_list_plants_excludes_archived(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("clean6")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id, quantity=2)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant1 = svc.plant_seed(p.id, stack.id, pod.id)
        plant1.is_alive = False
        s.flush()
        svc.cleanup_plant(p.id, plant1.id)
        plant2 = svc.plant_seed(p.id, stack.id, pod.id)
        ids = [pl.id for pl in svc.list_plants(p.id)]
        assert plant1.id not in ids
        assert plant2.id in ids


# ----- Stored harvest sale + curing --------------------------------------
def test_sell_harvest_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("sell0")
        with pytest.raises(GameError):
            svc.sell_harvest(p.id, "no-harvest")


def test_list_harvests_returns_rows(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("sell1")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80, sell=False)
        assert len(svc.list_harvests(p.id)) == 1


def _stored_harvest(svc, s, player_name):
    p = svc.create_player(player_name)
    strain = _strain(s, "blue-dream")
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Room", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    h = svc.harvest_plant(p.id, plant.id, weight_g=50, quality=80, sell=False)
    return p, h


def test_sell_harvest_already_sold(db):
    with session_scope() as s:
        svc = GameService(s)
        p, h = _stored_harvest(svc, s, "sold0")
        svc.sell_harvest(p.id, h.id)
        with pytest.raises(GameError):
            svc.sell_harvest(p.id, h.id)


def test_start_cure_then_block_sell_while_curing(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, h = _stored_harvest(svc, s, "cure0")
        svc.start_cure(p.id, h.id, target_hours=10)
        # Cannot sell a harvest mid-cure.
        with pytest.raises(GameError):
            svc.sell_harvest(p.id, h.id)


def test_start_cure_rejects_nonpositive_duration(db):
    with session_scope() as s:
        svc = GameService(s)
        p, h = _stored_harvest(svc, s, "cure1")
        with pytest.raises(GameError):
            svc.start_cure(p.id, h.id, target_hours=0)


def test_start_cure_twice_raises(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, h = _stored_harvest(svc, s, "cure2")
        svc.start_cure(p.id, h.id, target_hours=10)
        with pytest.raises(GameError):
            svc.start_cure(p.id, h.id, target_hours=10)


def test_start_cure_on_sold_harvest_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        p, h = _stored_harvest(svc, s, "cure3")
        svc.sell_harvest(p.id, h.id)
        with pytest.raises(GameError):
            svc.start_cure(p.id, h.id)


def test_finish_cure_not_curing_raises(db):
    with session_scope() as s:
        svc = GameService(s)
        p, h = _stored_harvest(svc, s, "cure4")
        with pytest.raises(GameError):
            svc.finish_cure(p.id, h.id)


def test_finish_cure_not_done_yet_raises(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, h = _stored_harvest(svc, s, "cure5")
        svc.start_cure(p.id, h.id, target_hours=72)
        # No time passed -> not finished.
        with pytest.raises(GameError):
            svc.finish_cure(p.id, h.id)


def test_finish_cure_success_after_time(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, h = _stored_harvest(svc, s, "cure6")
        svc.start_cure(p.id, h.id, target_hours=10)
        clock.advance(hours=240)  # well past target
        out = svc.finish_cure(p.id, h.id, sell=True)
        assert out.cure_status == "cured"
        assert out.sold is True


# ----- Marketplace listing errors ----------------------------------------
def test_create_seed_listing_seed_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("mkt0")
        with pytest.raises(GameError):
            svc.create_seed_listing(p.id, "no-seed", 1, 100)


def test_create_seed_listing_not_enough_seeds(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("mkt1")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id, quantity=1)
        with pytest.raises(GameError):
            svc.create_seed_listing(p.id, stack.id, 5, 100)


def test_create_seed_listing_price_must_be_positive(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("mkt2")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id, quantity=1)
        with pytest.raises(GameError):
            svc.create_seed_listing(p.id, stack.id, 1, 0)


def test_buy_listing_not_available(db):
    with session_scope() as s:
        svc = GameService(s)
        b = svc.create_player("buyer0")
        with pytest.raises(GameError):
            svc.buy_listing(b.id, "no-listing")


def test_buy_listing_cannot_buy_own(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        seller = svc.create_player("seller0")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(seller.id, strain.id, quantity=1)
        listing = svc.create_seed_listing(seller.id, stack.id, 1, 100)
        with pytest.raises(GameError):
            svc.buy_listing(seller.id, listing.id)


# ----- Auctions -----------------------------------------------------------
def _seed_seller(svc, s, name, qty=2):
    p = svc.create_player(name)
    strain = _strain(s, "blue-dream")
    stack = svc.buy_seed(p.id, strain.id, quantity=qty)
    return p, stack


def test_create_auction_seed_not_found(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("auc0")
        with pytest.raises(GameError):
            svc.create_seed_auction(p.id, "no-seed", 1, 50)


def test_create_auction_not_enough_seeds(db):
    with session_scope() as s:
        svc = GameService(s)
        p, stack = _seed_seller(svc, s, "auc1", qty=1)
        with pytest.raises(GameError):
            svc.create_seed_auction(p.id, stack.id, 5, 50)


def test_create_auction_min_bid_must_be_positive(db):
    with session_scope() as s:
        svc = GameService(s)
        p, stack = _seed_seller(svc, s, "auc2")
        with pytest.raises(GameError):
            svc.create_seed_auction(p.id, stack.id, 1, 0)


def test_place_bid_auction_not_available(db):
    with session_scope() as s:
        svc = GameService(s)
        b = svc.create_player("bid0")
        with pytest.raises(GameError):
            svc.place_bid(b.id, "no-auction", 50)


def test_place_bid_cannot_bid_own(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc3")
        a = svc.create_seed_auction(p.id, stack.id, 1, 50)
        with pytest.raises(GameError):
            svc.place_bid(p.id, a.id, 60)


def test_place_bid_after_end_raises(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc4")
        a = svc.create_seed_auction(p.id, stack.id, 1, 50, duration_hours=1)
        bidder = svc.create_player("bidder4")
        _fund(s, bidder.id)
        clock.advance(hours=5)  # auction ended
        with pytest.raises(GameError):
            svc.place_bid(bidder.id, a.id, 60)


def test_place_bid_below_min_raises(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc5")
        a = svc.create_seed_auction(p.id, stack.id, 1, 50)
        bidder = svc.create_player("bidder5")
        _fund(s, bidder.id)
        with pytest.raises(GameError):
            svc.place_bid(bidder.id, a.id, 10)


def test_place_bid_must_beat_standing_bid(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc6")
        a = svc.create_seed_auction(p.id, stack.id, 1, 50)
        b1 = svc.create_player("bidder6a")
        b2 = svc.create_player("bidder6b")
        _fund(s, b1.id)
        _fund(s, b2.id)
        svc.place_bid(b1.id, a.id, 60)
        # A second bid that doesn't exceed the standing high bid is rejected.
        with pytest.raises(GameError):
            svc.place_bid(b2.id, a.id, 60)
        # And a real higher bid refunds the previous bidder.
        b1_before = balance(s, b1.id)
        svc.place_bid(b2.id, a.id, 70)
        assert balance(s, b1.id) == b1_before + Decimal("60")


def test_settle_auction_errors_and_success(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc7")
        a = svc.create_seed_auction(p.id, stack.id, 1, 50, duration_hours=1)

        # Not found / not an auction.
        with pytest.raises(GameError):
            svc.settle_auction(p.id, "no-auction")

        # Only the seller can settle.
        other = svc.create_player("other7")
        with pytest.raises(GameError):
            svc.settle_auction(other.id, a.id)

        # Not ended yet.
        with pytest.raises(GameError):
            svc.settle_auction(p.id, a.id)

        # Place a bid, end the auction, settle to the winner.
        bidder = svc.create_player("bidder7")
        _fund(s, bidder.id)
        svc.place_bid(bidder.id, a.id, 60)
        clock.advance(hours=5)
        out = svc.settle_auction(p.id, a.id)
        assert out.buyer_id == bidder.id
        assert out.status == "sold"

        # Settling again -> already settled.
        with pytest.raises(GameError):
            svc.settle_auction(p.id, a.id)


def test_settle_auction_no_bids_returns_seeds(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc = GameService(s, clock=clock)
        p, stack = _seed_seller(svc, s, "auc8", qty=2)
        a = svc.create_seed_auction(p.id, stack.id, 2, 50, duration_hours=1)
        # Seeds were escrowed.
        assert s.get(type(stack), stack.id).quantity == 0
        clock.advance(hours=5)
        out = svc.settle_auction(p.id, a.id)
        assert out.status == "expired"
        # Escrowed seeds returned.
        assert s.get(type(stack), stack.id).quantity == 2


# ----- Lineage verification edge ----------------------------------------
def test_verify_lineage_unknown_strain_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            GameService(s).verify_lineage("no-strain")
