"""Market auctions: bids, outbid refunds, settlement."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, SeedInventory
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1)


def _seller_with_seed(s, clock):
    svc = GameService(s, clock=clock)
    seller = svc.create_player("auctioneer")
    strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
    stack = svc.buy_seed(seller.id, strain.id)
    return svc, seller, stack


def test_auction_bidding_and_outbid_refund(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, seller, stack = _seller_with_seed(s, clock)
        a = svc.create_player("alice")
        b = svc.create_player("bob")
        auction = svc.create_seed_auction(seller.id, stack.id, 1, 50, duration_hours=24)

        svc.place_bid(a.id, auction.id, 60)
        assert balance(s, a.id) == Decimal("500") - Decimal("60")
        # Bob outbids; Alice is refunded.
        svc.place_bid(b.id, auction.id, 80)
        assert balance(s, a.id) == Decimal("500")          # refunded
        assert balance(s, b.id) == Decimal("500") - Decimal("80")
        assert auction.highest_bidder_id == b.id


def test_later_bid_at_min_bid_is_rejected_once_floor_rises(db):
    # Regression: a player must not be able to re-bid the opening min_bid (or any
    # amount <= the standing high bid) after the floor has risen.
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, seller, stack = _seller_with_seed(s, clock)
        a = svc.create_player("alice")
        b = svc.create_player("bob")
        auction = svc.create_seed_auction(seller.id, stack.id, 1, 50, duration_hours=24)

        svc.place_bid(a.id, auction.id, 80)          # floor is now 80
        before = balance(s, a.id)
        # Re-bidding the original min_bid must fail and leave the auction untouched.
        with pytest.raises(GameError):
            svc.place_bid(b.id, auction.id, 50)
        # Equalling the standing high bid must also fail.
        with pytest.raises(GameError):
            svc.place_bid(b.id, auction.id, 80)
        assert auction.highest_bidder_id == a.id
        assert auction.highest_bid == Decimal("80")
        assert balance(s, a.id) == before            # not refunded
        assert balance(s, b.id) == Decimal("500")    # never debited


def test_settle_pays_seller_and_delivers_seed(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, seller, stack = _seller_with_seed(s, clock)
        b = svc.create_player("winner")
        auction = svc.create_seed_auction(seller.id, stack.id, 1, 50, duration_hours=24)
        svc.place_bid(b.id, auction.id, 100)

        # Cannot settle before expiry.
        with pytest.raises(GameError):
            svc.settle_auction(seller.id, auction.id)

        clock.advance(hours=25)
        seller_before = balance(s, seller.id)
        svc.settle_auction(seller.id, auction.id)
        # Seller gets bid minus 5% tax = 95.
        assert balance(s, seller.id) == seller_before + Decimal("95")
        won = s.query(SeedInventory).filter_by(
            player_id=b.id, strain_id=auction.item_ref_id
        ).one()
        assert won.quantity == 1
        assert auction.status == "sold"


def test_settle_with_no_bids_returns_seeds(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, seller, stack = _seller_with_seed(s, clock)
        auction = svc.create_seed_auction(seller.id, stack.id, 1, 50, duration_hours=24)
        assert s.get(SeedInventory, stack.id).quantity == 0  # escrowed
        clock.advance(hours=25)
        svc.settle_auction(seller.id, auction.id)
        assert s.get(SeedInventory, stack.id).quantity == 1  # returned
        assert auction.status == "expired"
