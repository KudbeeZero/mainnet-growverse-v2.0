"""Concurrency safety on the auction path.

Companion to test_concurrency.py (which covers wallets/harvests). Auctions need
their own optimistic lock because two *first* bids debit two different bidder
wallets — the wallet-level lock can't serialize them, so without a lock on the
listing row the loser is debited (AUCTION_BID) with no standing bid and no
refund. The version counter on market_listings makes the listing the
serialization point.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.db.session import get_sessionmaker
from growpodempire.db.models import Strain, MarketListing
from growpodempire.economy import ledger
from growpodempire.services.game_service import GameService


def _funded_player(session, name, balance="100"):
    svc = GameService(session)
    p = svc.create_player(name)
    w = ledger.get_wallet(session, p.id)
    w.cached_balance = ledger.to_money(balance)
    session.flush()
    return p.id


def test_concurrent_first_bids_dont_strand_the_losers_funds(session):
    """Two bidders place their first bid on the same auction at the same instant.
    Exactly one commits; the other loses the listing's optimistic-lock race and
    rolls back — so the loser is NOT debited and there is exactly one standing
    bid. Before the version counter, both committed and the loser's AUCTION_BID
    debit was stranded (no high-bid claim, no refund)."""
    seller = _funded_player(session, "seller", "1000")
    strain = session.query(Strain).first()
    svc = GameService(session)
    stack = svc.buy_seed(seller, strain.id)
    listing = svc.create_seed_auction(seller, stack.id, quantity=1, min_bid="10")
    listing_id = listing.id

    b1 = _funded_player(session, "bidder_one", "100")
    b2 = _funded_player(session, "bidder_two", "100")
    session.commit()

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        # Both read the listing at version 0 (no standing bid) and each posts its
        # first bid debit against its own wallet.
        GameService(s1).place_bid(b1, listing_id, "50")
        GameService(s2).place_bid(b2, listing_id, "50")

        s1.commit()  # winner: listing version 0 -> 1
        with pytest.raises(StaleDataError):
            s2.commit()  # WHERE version=0 matches 0 rows -> stale
        s2.rollback()
    finally:
        s1.close()
        s2.close()

    session.expire_all()
    # Winner debited once; loser fully refunded by the rollback (never debited).
    assert ledger.balance(session, b1) == ledger.to_money("50")
    assert ledger.balance(session, b2) == ledger.to_money("100")
    # Exactly one standing high bid, and it's the winner's.
    final = session.get(MarketListing, listing_id)
    assert final.highest_bidder_id == b1
    assert final.highest_bid == ledger.to_money("50")
