"""
HTTP-boundary coverage for the marketplace / auction routes in
``api/game_api.py`` (the ``/api/game/.../market...`` family).

These drive the Flask routes directly — request parsing, per-player API-key auth,
status codes, and GameError mapping — for the six market endpoints:

    GET  /api/game/market                              (public listings)
    POST /api/game/players/<id>/market/list            (fixed-price seed listing)
    POST /api/game/players/<id>/market/auction         (create auction)
    POST /api/game/players/<id>/market/<listing>/bid
    POST /api/game/players/<id>/market/<listing>/settle (auction settle/expiry)
    POST /api/game/players/<id>/market/<listing>/buy    (buy fixed listing)

The marketplace feature flag defaults ON in balance.yaml, so the routes are
reachable with no setup. Seeds are FREE in the live test balance, so a seller can
buy a seed to list/auction with no funds; buyers start with the 500 GROW grant.

Auction expiry is driven by the shared simulation clock. The HTTP layer builds a
fresh GameService per request, all sharing the same ``active_clock()`` singleton,
so the dev-clock fixture (``clock_client``) lets us advance time via
``/api/dev/clock/advance`` to cross an auction's ``expires_at`` — the same
technique used in tests/test_test_clock.py.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.config import get_settings
from growpodempire.simulation import clock as clock_mod


# --- fixtures ----------------------------------------------------------------

@pytest.fixture()
def client(db):
    """Plain Flask test client (no dev clock)."""
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


@pytest.fixture()
def clock_client(db, monkeypatch):
    """Test client with the dev clock ENABLED so auction expiry is controllable."""
    from growpodempire.api.flask_api import create_app

    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    clock_mod.reset_test_clock()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        clock_mod.reset_test_clock()
        get_settings.cache_clear()


# --- helpers -----------------------------------------------------------------

def _new_player(client, username="trader"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _buy_seed(client, pid, key):
    """Buy one seed (free in the test balance) and return its inventory id."""
    sid = client.get("/api/game/strains").get_json()[0]["id"]
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()["id"]


def _list_seed(client, pid, key, unit_price=100, quantity=1):
    seed_id = _buy_seed(client, pid, key)
    return client.post(
        f"/api/game/players/{pid}/market/list",
        json={"seed_id": seed_id, "quantity": quantity, "unit_price": unit_price},
        headers={"X-API-Key": key},
    )


def _auction_seed(client, pid, key, min_bid=50, quantity=1, duration_hours=24):
    seed_id = _buy_seed(client, pid, key)
    return client.post(
        f"/api/game/players/{pid}/market/auction",
        json={
            "seed_id": seed_id,
            "quantity": quantity,
            "min_bid": min_bid,
            "duration_hours": duration_hours,
        },
        headers={"X-API-Key": key},
    )


# --- GET /market (public) ----------------------------------------------------

def test_market_is_public_and_lists_open_listings(client):
    sid, skey = _new_player(client, "seller")

    # Empty to begin with.
    r = client.get("/api/game/market")
    assert r.status_code == 200
    assert r.get_json() == []

    r = _list_seed(client, sid, skey, unit_price=100)
    assert r.status_code == 201
    listing = r.get_json()
    assert listing["status"] == "active"
    assert listing["is_auction"] is False
    assert listing["unit_price"] == 100.0

    # No auth header needed for the public read.
    market = client.get("/api/game/market").get_json()
    assert [x["id"] for x in market] == [listing["id"]]
    assert market[0]["seller_id"] == sid


# --- POST .../market/list (fixed-price listing) ------------------------------

def test_list_requires_auth(client):
    sid, skey = _new_player(client, "seller")
    seed_id = _buy_seed(client, sid, skey)
    r = client.post(
        f"/api/game/players/{sid}/market/list",
        json={"seed_id": seed_id, "quantity": 1, "unit_price": 100},
    )
    assert r.status_code == 401


def test_list_missing_fields_is_400(client):
    sid, skey = _new_player(client, "seller")
    r = client.post(
        f"/api/game/players/{sid}/market/list",
        json={"quantity": 1, "unit_price": 100},  # no seed_id
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_list_rejects_nonpositive_price(client):
    sid, skey = _new_player(client, "seller")
    seed_id = _buy_seed(client, sid, skey)
    r = client.post(
        f"/api/game/players/{sid}/market/list",
        json={"seed_id": seed_id, "quantity": 1, "unit_price": 0},
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_list_unknown_seed_is_400(client):
    sid, skey = _new_player(client, "seller")
    r = client.post(
        f"/api/game/players/{sid}/market/list",
        json={"seed_id": "does-not-exist", "quantity": 1, "unit_price": 100},
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


# --- POST .../market/<id>/buy (buy a fixed listing) --------------------------

def test_buy_listing_transfers_seed_and_currency(client):
    sid, skey = _new_player(client, "seller")
    bid_, bkey = _new_player(client, "buyer")
    listing = _list_seed(client, sid, skey, unit_price=100).get_json()

    def bal(pid, key):
        return client.get(
            f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
        ).get_json()["balance"]

    r = client.post(
        f"/api/game/players/{bid_}/market/{listing['id']}/buy",
        headers={"X-API-Key": bkey},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["status"] == "sold"
    assert body["buyer_id"] == bid_

    # Buyer paid 100 (500 -> 400); seller netted the sale (minus tax) above 500.
    assert bal(bid_, bkey) == 400.0
    assert bal(sid, skey) > 500.0

    # Listing is no longer open on the public market.
    assert client.get("/api/game/market").get_json() == []


def test_buy_own_listing_is_rejected(client):
    sid, skey = _new_player(client, "seller")
    listing = _list_seed(client, sid, skey, unit_price=100).get_json()
    r = client.post(
        f"/api/game/players/{sid}/market/{listing['id']}/buy",
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_buy_with_insufficient_funds_is_rejected(client):
    sid, skey = _new_player(client, "seller")
    bid_, bkey = _new_player(client, "buyer")
    # Price above the buyer's 500 GROW grant, but the listing fee (3% = 18) is
    # still affordable for the seller's own 500 grant.
    list_resp = _list_seed(client, sid, skey, unit_price=600)
    assert list_resp.status_code == 201, list_resp.get_json()
    listing = list_resp.get_json()
    r = client.post(
        f"/api/game/players/{bid_}/market/{listing['id']}/buy",
        headers={"X-API-Key": bkey},
    )
    assert r.status_code == 400


def test_buy_unknown_listing_is_400(client):
    bid_, bkey = _new_player(client, "buyer")
    r = client.post(
        f"/api/game/players/{bid_}/market/nope/buy",
        headers={"X-API-Key": bkey},
    )
    assert r.status_code == 400


def test_buy_requires_auth(client):
    sid, skey = _new_player(client, "seller")
    listing = _list_seed(client, sid, skey, unit_price=100).get_json()
    bid_, _ = _new_player(client, "buyer")
    r = client.post(f"/api/game/players/{bid_}/market/{listing['id']}/buy")
    assert r.status_code == 401


# --- POST .../market/auction (create auction) --------------------------------

def test_create_auction_happy_path(client):
    sid, skey = _new_player(client, "auctioneer")
    r = _auction_seed(client, sid, skey, min_bid=50)
    assert r.status_code == 201
    body = r.get_json()
    assert body["is_auction"] is True
    assert body["min_bid"] == 50.0
    assert body["status"] == "active"
    assert body["expires_at"] is not None


def test_create_auction_missing_fields_is_400(client):
    sid, skey = _new_player(client, "auctioneer")
    seed_id = _buy_seed(client, sid, skey)
    r = client.post(
        f"/api/game/players/{sid}/market/auction",
        json={"seed_id": seed_id, "quantity": 1},  # no min_bid
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_create_auction_requires_auth(client):
    sid, skey = _new_player(client, "auctioneer")
    seed_id = _buy_seed(client, sid, skey)
    r = client.post(
        f"/api/game/players/{sid}/market/auction",
        json={"seed_id": seed_id, "quantity": 1, "min_bid": 50},
    )
    assert r.status_code == 401


# --- POST .../market/<id>/bid ------------------------------------------------

def test_bid_happy_path_and_outbid_refund(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    a_id, akey = _new_player(client, "alice")
    b_id, bkey = _new_player(client, "bob")

    def bal(pid, key):
        return client.get(
            f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
        ).get_json()["balance"]

    r = client.post(
        f"/api/game/players/{a_id}/market/{auction['id']}/bid",
        json={"amount": 60},
        headers={"X-API-Key": akey},
    )
    assert r.status_code == 200
    assert r.get_json()["highest_bidder_id"] == a_id
    assert bal(a_id, akey) == 440.0  # 500 - 60 escrowed

    # Bob outbids; Alice is refunded.
    r = client.post(
        f"/api/game/players/{b_id}/market/{auction['id']}/bid",
        json={"amount": 80},
        headers={"X-API-Key": bkey},
    )
    assert r.status_code == 200
    assert r.get_json()["highest_bidder_id"] == b_id
    assert bal(a_id, akey) == 500.0    # refunded
    assert bal(b_id, bkey) == 420.0    # 500 - 80 escrowed


def test_bid_below_current_high_is_rejected(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    a_id, akey = _new_player(client, "alice")
    b_id, bkey = _new_player(client, "bob")

    client.post(
        f"/api/game/players/{a_id}/market/{auction['id']}/bid",
        json={"amount": 80},
        headers={"X-API-Key": akey},
    )
    # Below the standing high bid -> rejected.
    r = client.post(
        f"/api/game/players/{b_id}/market/{auction['id']}/bid",
        json={"amount": 50},
        headers={"X-API-Key": bkey},
    )
    assert r.status_code == 400


def test_bid_missing_amount_is_400(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    a_id, akey = _new_player(client, "alice")
    r = client.post(
        f"/api/game/players/{a_id}/market/{auction['id']}/bid",
        json={},
        headers={"X-API-Key": akey},
    )
    assert r.status_code == 400


def test_bid_requires_auth(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    a_id, _ = _new_player(client, "alice")
    r = client.post(
        f"/api/game/players/{a_id}/market/{auction['id']}/bid",
        json={"amount": 60},
    )
    assert r.status_code == 401


def test_bid_unknown_listing_is_400(client):
    a_id, akey = _new_player(client, "alice")
    r = client.post(
        f"/api/game/players/{a_id}/market/nope/bid",
        json={"amount": 60},
        headers={"X-API-Key": akey},
    )
    assert r.status_code == 400


# --- POST .../market/<id>/settle ---------------------------------------------

def test_settle_before_close_is_rejected(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    b_id, bkey = _new_player(client, "bob")
    client.post(
        f"/api/game/players/{b_id}/market/{auction['id']}/bid",
        json={"amount": 100},
        headers={"X-API-Key": bkey},
    )
    # Auction is still open -> settling early is rejected.
    r = client.post(
        f"/api/game/players/{sid}/market/{auction['id']}/settle",
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_settle_unknown_listing_is_400(client):
    sid, skey = _new_player(client, "auctioneer")
    r = client.post(
        f"/api/game/players/{sid}/market/nope/settle",
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 400


def test_settle_requires_auth(client):
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50).get_json()
    r = client.post(f"/api/game/players/{sid}/market/{auction['id']}/settle")
    assert r.status_code == 401


def test_settle_after_expiry_pays_seller_and_delivers_seed(clock_client):
    """Full settle path: advance the shared dev clock past expiry, then settle."""
    client = clock_client
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50, duration_hours=24).get_json()
    b_id, bkey = _new_player(client, "bob")

    client.post(
        f"/api/game/players/{b_id}/market/{auction['id']}/bid",
        json={"amount": 100},
        headers={"X-API-Key": bkey},
    )

    def bal(pid, key):
        return client.get(
            f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
        ).get_json()["balance"]

    seller_before = bal(sid, skey)

    # Cross the 24h expiry.
    adv = client.post("/api/dev/clock/advance", json={"hours": 25})
    assert adv.status_code == 200

    r = client.post(
        f"/api/game/players/{sid}/market/{auction['id']}/settle",
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["status"] == "sold"
    assert body["buyer_id"] == b_id
    # Seller is credited the winning bid minus the marketplace tax.
    assert bal(sid, skey) > seller_before


def test_settle_after_expiry_with_no_bids_returns_seed(clock_client):
    """Expiry with no bids: auction ends 'expired' and the seed is returned."""
    client = clock_client
    sid, skey = _new_player(client, "auctioneer")
    auction = _auction_seed(client, sid, skey, min_bid=50, duration_hours=24).get_json()

    client.post("/api/dev/clock/advance", json={"hours": 25})

    r = client.post(
        f"/api/game/players/{sid}/market/{auction['id']}/settle",
        headers={"X-API-Key": skey},
    )
    assert r.status_code == 200
    assert r.get_json()["status"] == "expired"
